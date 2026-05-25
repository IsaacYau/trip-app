import json
import os
import random

# Seed for deterministic random generation (coordinates and prices)
random.seed(42)

# Exchange rates as specified by the user:
# 100 JPY = 5.0 HKD => 1 JPY = 0.05 HKD
# 1 MYR = 2.0 HKD
JPY_TO_HKD = 0.05
MYR_TO_HKD = 2.0

# Center coordinates for Japan cities (Nagoya, Osaka, Kobe, Tateyama, Kuwana, Suzuka) 
# and Malaysia cities (Kuala Lumpur, George Town)
CITY_CENTERS = {
    "nagoya": {"lat": 35.1815, "lng": 136.9066, "country": "Japan", "currency": "JPY"},
    "osaka": {"lat": 34.6937, "lng": 135.5023, "country": "Japan", "currency": "JPY"},
    "kobe": {"lat": 34.6901, "lng": 135.1955, "country": "Japan", "currency": "JPY"},
    "tateyama": {"lat": 36.5781, "lng": 137.6017, "country": "Japan", "currency": "JPY"},
    "kuwana": {"lat": 35.0673, "lng": 136.6806, "country": "Japan", "currency": "JPY"},
    "suzuka": {"lat": 34.8817, "lng": 136.5824, "country": "Japan", "currency": "JPY"},
    "kuala lumpur": {"lat": 3.1390, "lng": 101.6869, "country": "Malaysia", "currency": "MYR"},
    "george town": {"lat": 5.4141, "lng": 100.3288, "country": "Malaysia", "currency": "MYR"},
    "penang": {"lat": 5.4141, "lng": 100.3288, "country": "Malaysia", "currency": "MYR"}
}

def clean_title(title):
    if not title:
        return ""
    return " ".join(title.lower().split())

def get_unified_category(cat_name):
    if not cat_name:
        return "Sights"
    cat_lower = cat_name.lower()
    if any(k in cat_lower for k in ["restaurant", "cafe", "coffee", "hawker", "food", "sushi", "izakaya", "steak", "ramen", "yakiniku", "diner", "bistro", "pub", "bar", "bakery", "sweet", "dessert"]):
        return "Food"
    if any(k in cat_lower for k in ["shop", "store", "mall", "market", "boutique", "plaza"]):
        return "Shopping"
    if any(k in cat_lower for k in ["park", "attraction", "landmark", "temple", "shrine", "museum", "deck", "bridge", "garden", "nature", "mountain", "beach", "valley", "view"]):
        return "Sights"
    return "Entertainment"

def load_enrichment_data(country):
    ratings_dict = {}
    reviews_dict = {}
    image_urls_dict = {}
    
    if country == "Japan":
        rating_file = "japan_rating.json"
        reviews_file = "japan_reviews.json"
        image_file = "japan_imageurl.json"
    else:
        rating_file = "malaysia_rating.json"
        reviews_file = "malaysia_reviews.json"
        image_file = "malaysia_imageurl.json"
        
    print(f"Loading extra data for {country}...")
    
    # Load Ratings
    if os.path.exists(rating_file):
        with open(rating_file, "r", encoding="utf-8") as f:
            try:
                ratings_data = json.load(f)
                for item in ratings_data:
                    title = item.get("title")
                    if title:
                        ratings_dict[clean_title(title)] = {
                            "rating": round(float(item.get("totalScore") or 0.0), 1),
                            "reviewsCount": int(item.get("reviewsCount") or 0)
                        }
            except Exception as e:
                print(f"Warning: Failed to load {rating_file}: {e}")
                    
    # Load Reviews
    if os.path.exists(reviews_file):
        with open(reviews_file, "r", encoding="utf-8") as f:
            try:
                reviews_data = json.load(f)
                for item in reviews_data:
                    title = item.get("title")
                    text = item.get("text")
                    if title and text:
                        key = clean_title(title)
                        if key not in reviews_dict:
                            reviews_dict[key] = []
                        if len(reviews_dict[key]) < 3: # limit to top 3 comments
                            reviews_dict[key].append(text)
            except Exception as e:
                print(f"Warning: Failed to load {reviews_file}: {e}")
                        
    # Load Image URLs
    if os.path.exists(image_file):
        with open(image_file, "r", encoding="utf-8") as f:
            try:
                image_data = json.load(f)
                for item in image_data:
                    title = item.get("title")
                    img_url = item.get("imageUrl")
                    if title and img_url:
                        image_urls_dict[clean_title(title)] = img_url
            except Exception as e:
                print(f"Warning: Failed to load {image_file}: {e}")
                    
    return ratings_dict, reviews_dict, image_urls_dict

def process_file(filepath, allowed_cities, default_country, ratings_dict, reviews_dict, image_urls_dict):
    print(f"Reading raw data from {filepath}...")
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found!")
        return []
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    records = []
    for item in data:
        # Check city
        city_raw = item.get("city")
        if not city_raw:
            continue
        
        city_lower = city_raw.lower().strip()
        
        # Match allowed cities
        matched_city = None
        for allowed in allowed_cities:
            if allowed in city_lower:
                matched_city = allowed
                break
        
        if not matched_city:
            continue
        
        # Determine display name
        if matched_city == "tateyama":
            city_display = "Tateyama Kurobe"
        elif matched_city in ["george town", "penang"]:
            city_display = "George Town"
        else:
            city_display = matched_city.capitalize()
            
        city_key = "george town" if matched_city in ["george town", "penang"] else matched_city
        
        center_info = CITY_CENTERS[city_key]
        country = center_info["country"]
        currency = center_info["currency"]
        
        # Extract title (Name)
        title = item.get("title")
        if not title:
            continue
        
        clean_key = clean_title(title)
        
        # Match score and rating count from ratings_dict
        rating = item.get("totalScore") or 0.0
        reviews_count = item.get("reviewsCount") or 0
        if clean_key in ratings_dict:
            rating = ratings_dict[clean_key]["rating"]
            reviews_count = ratings_dict[clean_key]["reviewsCount"]
            
        rating = round(float(rating), 1)
        reviews_count = int(reviews_count)
        
        # Match review comments
        reviews_list = reviews_dict.get(clean_key, [])
        
        # Match imageUrl
        image_url = image_urls_dict.get(clean_key, "")
        
        # Category mapping
        cat_name = item.get("categoryName") or (item.get("categories")[0] if item.get("categories") else None)
        unified_category = get_unified_category(cat_name)
        
        # Coordinates (Coordinates)
        # Add a pseudo-random deterministic spread around city center (~1.5km)
        lat_offset = random.uniform(-0.015, 0.015)
        lng_offset = random.uniform(-0.015, 0.015)
        lat = round(center_info["lat"] + lat_offset, 6)
        lng = round(center_info["lng"] + lng_offset, 6)
        
        # Price generation based on category & country
        price_local = 0
        price_level = "$"
        
        if unified_category == "Food":
            if currency == "JPY":
                price_local = random.randint(1200, 5500)
                price_level = "$" if price_local < 2200 else ("$$" if price_local < 4000 else "$$$")
            else: # MYR
                price_local = random.randint(15, 80)
                price_level = "$" if price_local < 30 else ("$$" if price_local < 60 else "$$$")
        elif unified_category == "Sights":
            if currency == "JPY":
                price_local = random.choice([0, 0, 0, 500, 1000, 1500, 2500])
                if price_local == 0:
                    price_level = "Free"
                else:
                    price_level = "$" if price_local < 1000 else ("$$" if price_local < 2000 else "$$$")
            else: # MYR
                price_local = random.choice([0, 0, 0, 10, 20, 35, 50])
                if price_local == 0:
                    price_level = "Free"
                else:
                    price_level = "$" if price_local < 15 else ("$$" if price_local < 30 else "$$$")
        elif unified_category == "Shopping":
            if currency == "JPY":
                price_local = random.choice([0, 0, 1000, 3000, 5000])
                price_level = "Free" if price_local == 0 else ("$" if price_local < 2000 else "$$")
            else: # MYR
                price_local = random.choice([0, 0, 15, 40, 75])
                price_level = "Free" if price_local == 0 else ("$" if price_local < 30 else "$$")
        else: # Entertainment/Other
            if currency == "JPY":
                price_local = random.randint(800, 4000)
                price_level = "$" if price_local < 2000 else "$$"
            else: # MYR
                price_local = random.randint(10, 60)
                price_level = "$" if price_local < 30 else "$$"
        
        # Convert to HKD
        if currency == "JPY":
            price_hkd = round(price_local * JPY_TO_HKD, 1)
        else: # MYR
            price_hkd = round(price_local * MYR_TO_HKD, 1)
            
        records.append({
            "name": title,
            "city": city_display,
            "country": country,
            "category": unified_category,
            "rating": rating,
            "reviewsCount": reviews_count,
            "coordinates": {
                "lat": lat,
                "lng": lng
            },
            "price_local": price_local,
            "currency": currency,
            "price_hkd": price_hkd,
            "price_level": price_level,
            "street": item.get("street") or "",
            "imageUrl": image_url,
            "reviews": reviews_list
        })
        
    return records

def main():
    # Load Enrichment databases first
    j_ratings, j_reviews, j_images = load_enrichment_data("Japan")
    m_ratings, m_reviews, m_images = load_enrichment_data("Malaysia")
    
    # Load raw records
    japan_records = process_file("japan_raw.json", ["nagoya", "osaka", "kobe", "tateyama", "kuwana", "suzuka"], "Japan", j_ratings, j_reviews, j_images)
    malaysia_records = process_file("malaysia_raw.json", ["kuala lumpur", "george town", "penang"], "Malaysia", m_ratings, m_reviews, m_images)
    
    combined = japan_records + malaysia_records
    
    # Sort combined places so better places are ordered higher: rating score descending, then reviewsCount descending
    combined.sort(key=lambda x: (x["rating"], x["reviewsCount"]), reverse=True)
    
    print(f"Total parsed records: {len(combined)} (Japan: {len(japan_records)}, Malaysia: {len(malaysia_records)})")
    
    # Save output to main directory
    output_filename = "final_places_db.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully wrote {len(combined)} enriched, sorted records to {output_filename}!")

if __name__ == "__main__":
    main()
