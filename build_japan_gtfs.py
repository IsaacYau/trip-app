import urllib.request
import urllib.parse
import json
import zipfile
import csv
import io
import os
import re

# Bounding box for Nagoya, Osaka, Kobe, Kyoto
# format: (min_lat, min_lon, max_lat, max_lon)
BBOX = "34.5,135.0,35.5,137.2"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def query_overpass(q):
    print("Querying Overpass API (this might take a minute)...")
    data = urllib.parse.urlencode({'data': q}).encode('utf-8')
    req = urllib.request.Request(OVERPASS_URL, data=data, headers={'User-Agent': 'RoamReadyJapanGTFSGenerator/1.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def build_japan_gtfs():
    # 1. Fetch railway relations and their stops/stations
    # This query retrieves all route=train/subway/light_rail relations in our target box
    # and only recurses their node members (stations), skipping track geometries to be fast.
    query = f"""
    [out:json][timeout:180];
    (
      relation["route"="train"]({BBOX});
      relation["route"="subway"]({BBOX});
      relation["route"="light_rail"]({BBOX});
    );
    out body;
    node(r);
    out body;
    """
    
    try:
        raw_data = query_overpass(query)
    except Exception as e:
        print(f"Error querying Overpass API: {e}")
        return

    elements = raw_data.get("elements", [])
    print(f"Retrieved {len(elements)} OSM elements.")

    # Parse nodes (stations) and relations (routes)
    nodes = {}
    relations = []
    
    for el in elements:
        el_type = el.get("type")
        if el_type == "node":
            tags = el.get("tags", {})
            # We care about nodes that have a name and represent a station/stop
            if "name" in tags or tags.get("railway") == "station" or tags.get("railway") == "halt":
                nodes[el["id"]] = {
                    "lat": el["lat"],
                    "lon": el["lon"],
                    "name": tags.get("name:en") or tags.get("name") or f"Station {el['id']}",
                    "operator": tags.get("operator", "Unknown Operator")
                }
        elif el_type == "relation":
            relations.append(el)

    print(f"Parsed {len(nodes)} station nodes and {len(relations)} transit relations.")

    # Setup GTFS writing
    agency_rows = []
    stop_rows = []
    route_rows = []
    trip_rows = []
    stop_time_rows = []
    frequency_rows = []

    # Map operators to safe agency IDs
    operator_to_agency = {
        "JR West": "JR_WEST",
        "West Japan Railway Company": "JR_WEST",
        "西日本旅客鉄道": "JR_WEST",
        "Osaka Metro": "OSAKA_METRO",
        "大阪市高速電気軌道": "OSAKA_METRO",
        "Nagoya City Transportation Bureau": "NAGOYA_SUBWAY",
        "名古屋市交通局": "NAGOYA_SUBWAY",
        "Kobe City Transportation Bureau": "KOBE_SUBWAY",
        "神戸市交通局": "KOBE_SUBWAY",
        "Hankyu": "HANKYU",
        "阪急電鉄": "HANKYU",
        "Kintetsu": "KINTETSU",
        "近畿日本鉄道": "KINTETSU",
        "Meitetsu": "MEITETSU",
        "名古屋鉄道": "MEITETSU"
    }

    def get_agency(op_name):
        for key, agency_id in operator_to_agency.items():
            if key.lower() in op_name.lower():
                return agency_id, key
        # Default fallback
        clean_name = re.sub(r'[^a-zA-Z0-9 ]', '', op_name).strip()
        agency_id = clean_name.replace(" ", "_").upper() or "UNKNOWN_AGENCY"
        return agency_id, op_name or "Local Transit Operator"

    # Compile Agencies
    agencies_added = set()
    stops_added = set()

    # Process relations to build routes, trips, and stops
    route_id_counter = 1
    trip_id_counter = 1

    for rel in relations:
        tags = rel.get("tags", {})
        ref = tags.get("ref") or tags.get("symbol") or ""
        name = tags.get("name:en") or tags.get("name") or tags.get("route") or f"Line {rel['id']}"
        operator = tags.get("operator", "Japan Railways")
        
        agency_id, agency_name = get_agency(operator)
        
        # Add to agency.txt if new
        if agency_id not in agencies_added:
            agency_rows.append({
                "agency_id": agency_id,
                "agency_name": agency_name,
                "agency_url": "https://gtfs.roamready.local",
                "agency_timezone": "Asia/Tokyo"
            })
            agencies_added.add(agency_id)

        # Get route type (subway=1, rail=2, tram/lightrail=0)
        route_type = "2" # default rail
        if tags.get("route") == "subway" or "metro" in name.lower() or "subway" in name.lower():
            route_type = "1"
        elif tags.get("route") in ["tram", "light_rail"]:
            route_type = "0"

        route_id = f"R_{route_id_counter}"
        route_id_counter += 1
        
        route_rows.append({
            "route_id": route_id,
            "agency_id": agency_id,
            "route_short_name": ref or name[:6],
            "route_long_name": name,
            "route_type": route_type
        })

        # Process stops of this relation
        members = rel.get("members", [])
        relation_stops = []
        for member in members:
            # We look for nodes in the relation that represent stops/stations
            if member.get("type") == "node" and member.get("role") in ["stop", "platform", "station"]:
                node_id = member.get("ref")
                if node_id in nodes:
                    relation_stops.append(node_id)
        
        # If we didn't find specific stop nodes in members, let's find any nodes that map to stations
        if len(relation_stops) < 2:
            relation_stops = [m.get("ref") for m in members if m.get("type") == "node" and m.get("ref") in nodes]

        if len(relation_stops) < 2:
            # Skip empty or single-station routes
            continue

        # Add stops to stops.txt
        for stop_node_id in relation_stops:
            if stop_node_id not in stops_added:
                node_info = nodes[stop_node_id]
                stop_rows.append({
                    "stop_id": str(stop_node_id),
                    "stop_name": node_info["name"],
                    "stop_lat": str(node_info["lat"]),
                    "stop_lon": str(node_info["lon"]),
                    "location_type": "0"
                })
                stops_added.add(stop_node_id)

        # Generate Trips & Frequencies
        # We will create 2 trips per route: inbound and outbound
        for direction in [0, 1]:
            trip_id = f"T_{trip_id_counter}"
            trip_id_counter += 1
            
            trip_rows.append({
                "route_id": route_id,
                "service_id": "DAILY",
                "trip_id": trip_id,
                "direction_id": str(direction)
            })

            # Create stop times (e.g. 2 minutes apart)
            ordered_stops = relation_stops if direction == 0 else list(reversed(relation_stops))
            for i, stop_id in enumerate(ordered_stops):
                mins = i * 2
                h = mins // 60
                m = mins % 60
                time_str = f"{h:02d}:{m:02d}:00"
                
                stop_time_rows.append({
                    "trip_id": trip_id,
                    "arrival_time": time_str,
                    "departure_time": time_str,
                    "stop_id": str(stop_id),
                    "stop_sequence": str(i + 1)
                })

            # Frequency: Every 5 minutes (300 seconds) from 05:00:00 to 23:59:00
            frequency_rows.append({
                "trip_id": trip_id,
                "start_time": "05:00:00",
                "end_time": "23:59:00",
                "headway_secs": "300"
            })

    # Calendar.txt (DAILY service)
    calendar_rows = [{
        "service_id": "DAILY",
        "monday": "1", "tuesday": "1", "wednesday": "1", "thursday": "1", "friday": "1", "saturday": "1", "sunday": "1",
        "start_date": "20260101",
        "end_date": "20261231"
    }]

    # Write to zip file
    zip_filename = "japan_rail.zip"
    print(f"Creating {zip_filename}...")
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        def write_csv(filename, fieldnames, rows):
            out = io.StringIO()
            writer = csv.DictWriter(out, fieldnames=fieldnames, lineterminator='\n')
            writer.writeheader()
            writer.writerows(rows)
            zipf.writestr(filename, out.getvalue())

        write_csv("agency.txt", ["agency_id", "agency_name", "agency_url", "agency_timezone"], agency_rows)
        write_csv("stops.txt", ["stop_id", "stop_name", "stop_lat", "stop_lon", "location_type"], stop_rows)
        write_csv("routes.txt", ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type"], route_rows)
        write_csv("trips.txt", ["route_id", "service_id", "trip_id", "direction_id"], trip_rows)
        write_csv("stop_times.txt", ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], stop_time_rows)
        write_csv("frequencies.txt", ["trip_id", "start_time", "end_time", "headway_secs"], frequency_rows)
        write_csv("calendar.txt", ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"], calendar_rows)

    print(f"Successfully generated {zip_filename} with {len(stop_rows)} stops and {len(route_rows)} routes!")

if __name__ == "__main__":
    build_japan_gtfs()
