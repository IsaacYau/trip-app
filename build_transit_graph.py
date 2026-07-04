import zipfile
import json
import csv
import io
import os
import re

def parse_time_to_minutes(t_str):
    parts = list(map(int, t_str.strip().split(':')))
    # Handle hours >= 24 gracefully
    return parts[0] * 60 + parts[1] + parts[2]/60.0

def build_graph():
    # Final output graph structure
    nodes = {}
    links = []

    # Helper maps
    stop_id_to_name = {}
    stop_id_to_coords = {}
    stop_name_coords_accumulator = {} # name -> [lats, lons]

    # Process Malaysia GTFS archives
    zip_paths = {
        "rapid_rail.zip": "subway",
        "ktm_komuter.zip": "train"
    }

    for zip_name, transit_type in zip_paths.items():
        if not os.path.exists(zip_name):
            print(f"Skipping {zip_name} (file not found)")
            continue

        print(f"Parsing {zip_name}...")
        with zipfile.ZipFile(zip_name, 'r') as archive:
            # 1. Load stops
            stops_content = archive.read('stops.txt').decode('utf-8-sig')
            stops_reader = csv.DictReader(io.StringIO(stops_content))
            for row in stops_reader:
                stop_id = row['stop_id']
                stop_name = row['stop_name'].strip()
                lat = float(row['stop_lat'])
                lon = float(row['stop_lon'])
                
                stop_id_to_name[stop_id] = stop_name
                stop_id_to_coords[stop_id] = (lat, lon)
                
                if stop_name not in stop_name_coords_accumulator:
                    stop_name_coords_accumulator[stop_name] = ([], [])
                stop_name_coords_accumulator[stop_name][0].append(lat)
                stop_name_coords_accumulator[stop_name][1].append(lon)

            # 2. Load routes
            routes_content = archive.read('routes.txt').decode('utf-8-sig')
            routes_reader = csv.DictReader(io.StringIO(routes_content))
            route_id_to_info = {}
            for row in routes_reader:
                r_id = row['route_id']
                r_name = row['route_long_name'] or row['route_short_name']
                color = row.get('route_color', '').strip()
                if not color or color == '000000':
                    # Fallback colors for known lines
                    if 'Ampang' in r_name: color = 'e57200'
                    elif 'Kelana Jaya' in r_name: color = 'D50032'
                    elif 'Monorail' in r_name: color = '007A87'
                    elif 'Kajang' in r_name: color = '002D62'
                    elif 'Putrajaya' in r_name: color = 'FFD700'
                    elif 'KTM' in r_name or 'Komuter' in r_name: color = '004B87'
                    else: color = '4A5568'
                route_id_to_info[r_id] = {
                    "name": r_name,
                    "color": f"#{color}",
                    "type": transit_type
                }

            # 3. Load calendar
            calendar_info = {}
            if 'calendar.txt' in archive.namelist():
                cal_content = archive.read('calendar.txt').decode('utf-8-sig')
                cal_reader = csv.DictReader(io.StringIO(cal_content))
                for row in cal_reader:
                    s_id = row['service_id']
                    # Is active on weekdays (Mon-Fri)
                    mon_fri = [row.get(day, '0') == '1' for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']]
                    is_weekday = any(mon_fri)
                    # Is active on weekends (Sat-Sun)
                    sat_sun = [row.get(day, '0') == '1' for day in ['saturday', 'sunday']]
                    is_weekend = any(sat_sun)
                    calendar_info[s_id] = {"weekday": is_weekday, "weekend": is_weekend}

            # 4. Load frequencies if available
            trip_headways = {}
            if 'frequencies.txt' in archive.namelist():
                freq_content = archive.read('frequencies.txt').decode('utf-8-sig')
                freq_reader = csv.DictReader(io.StringIO(freq_content))
                for row in freq_reader:
                    t_id = row['trip_id']
                    headway = float(row['headway_secs']) / 60.0 # in minutes
                    if t_id not in trip_headways:
                        trip_headways[t_id] = []
                    trip_headways[t_id].append(headway)

            # 5. Load trips
            trips_content = archive.read('trips.txt').decode('utf-8-sig')
            trips_reader = csv.DictReader(io.StringIO(trips_content))
            trip_to_route_service = {}
            for row in trips_reader:
                t_id = row['trip_id']
                r_id = row['route_id']
                s_id = row['service_id']
                trip_to_route_service[t_id] = (r_id, s_id)

            # 6. Parse stop_times to construct links
            stop_times_content = archive.read('stop_times.txt').decode('utf-8-sig')
            stop_times_reader = csv.DictReader(io.StringIO(stop_times_content))
            
            # Group by trip_id
            trip_sequences = {}
            for row in stop_times_reader:
                t_id = row['trip_id']
                seq = int(row['stop_sequence'])
                stop_id = row['stop_id']
                arr = row['arrival_time']
                dep = row['departure_time']
                
                if t_id not in trip_sequences:
                    trip_sequences[t_id] = []
                trip_sequences[t_id].append((seq, stop_id, arr, dep))

            # Sort sequences per trip and extract adjacencies
            link_accumulator = {} # (u_name, v_name, line_name) -> { times: [], weekday_intervals: [], weekend_intervals: [] }

            for t_id, seq_list in trip_sequences.items():
                if t_id not in trip_to_route_service:
                    continue
                r_id, s_id = trip_to_route_service[t_id]
                if r_id not in route_id_to_info:
                    continue
                r_info = route_id_to_info[r_id]

                # Sort by sequence index
                seq_list.sort(key=lambda x: x[0])

                # Determine schedule type
                cal = calendar_info.get(s_id, {"weekday": True, "weekend": False})
                headway_list = trip_headways.get(t_id, [5.0])
                avg_headway = sum(headway_list) / len(headway_list)

                for i in range(len(seq_list) - 1):
                    u_stop = seq_list[i][1]
                    v_stop = seq_list[i+1][1]
                    u_name = stop_id_to_name.get(u_stop)
                    v_name = stop_id_to_name.get(v_stop)
                    
                    if not u_name or not v_name or u_name == v_name:
                        continue

                    # Calculate trip time
                    t1 = parse_time_to_minutes(seq_list[i][3]) # departure
                    t2 = parse_time_to_minutes(seq_list[i+1][2]) # arrival
                    trip_time = max(1.0, t2 - t1)

                    link_key = (u_name, v_name, r_info["name"])
                    if link_key not in link_accumulator:
                        link_accumulator[link_key] = {
                            "times": [],
                            "weekday_intervals": [],
                            "weekend_intervals": [],
                            "color": r_info["color"],
                            "type": r_info["type"]
                        }
                    
                    link_accumulator[link_key]["times"].append(trip_time)
                    if cal["weekday"]:
                        link_accumulator[link_key]["weekday_intervals"].append(avg_headway)
                    if cal["weekend"]:
                        link_accumulator[link_key]["weekend_intervals"].append(avg_headway)

            # Build average links
            for (u_name, v_name, line_name), data in link_accumulator.items():
                avg_time = sum(data["times"]) / len(data["times"])
                # Calculate realistic fare based on time
                avg_fare = round(1.0 + 0.25 * avg_time, 2)

                # Find headway intervals
                wday_int = sum(data["weekday_intervals"]) / len(data["weekday_intervals"]) if data["weekday_intervals"] else (5.0 if data["type"] == "subway" else 15.0)
                wend_int = sum(data["weekend_intervals"]) / len(data["weekend_intervals"]) if data["weekend_intervals"] else (8.0 if data["type"] == "subway" else 30.0)

                links.append({
                    "u": u_name,
                    "v": v_name,
                    "time": round(avg_time, 1),
                    "fare": avg_fare,
                    "line": line_name,
                    "color": data["color"],
                    "type": data["type"],
                    "schedule": {
                        "weekday": {"interval_minutes": round(wday_int, 1)},
                        "weekend": {"interval_minutes": round(wend_int, 1)}
                    }
                })

    # Unify node coordinates
    for name, (lats, lons) in stop_name_coords_accumulator.items():
        avg_lat = sum(lats) / len(lats)
        avg_lon = sum(lons) / len(lons)
        nodes[name] = {"lat": round(avg_lat, 6), "lon": round(avg_lon, 6)}

    # Verify nodes present in links are in the nodes list
    for link in links:
        if link["u"] not in nodes:
            nodes[link["u"]] = {"lat": 3.1390, "lon": 101.6869} # default to KL Center
        if link["v"] not in nodes:
            nodes[link["v"]] = {"lat": 3.1390, "lon": 101.6869}

    # Write out final database
    output_path = "malaysia_transit_db.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({"nodes": nodes, "links": links}, f, indent=2, ensure_ascii=False)

    print(f"Successfully compiled {len(nodes)} stations and {len(links)} links into {output_path}!")

if __name__ == '__main__':
    build_graph()
