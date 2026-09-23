"""
Geolocation service for VASP location mapping and jurisdiction detection.
Uses a curated demo dataset of known exchange headquarters and operational regions.
"""

from typing import List, Dict, Any, Optional


# Known VASP headquarters and operational locations (demo dataset)
VASP_LOCATIONS = {
    "Binance": {
        "entity_name": "Binance",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 25.2048, "lng": 55.2708, "city": "Dubai", "country": "UAE"},
        "offices": [
            {"lat": 1.3521, "lng": 103.8198, "city": "Singapore", "country": "Singapore"},
            {"lat": 48.8566, "lng": 2.3522, "city": "Paris", "country": "France"},
        ]
    },
    "WazirX": {
        "entity_name": "WazirX",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 19.0760, "lng": 72.8777, "city": "Mumbai", "country": "India"},
        "offices": [
            {"lat": 12.9716, "lng": 77.5946, "city": "Bangalore", "country": "India"},
        ]
    },
    "CoinDCX": {
        "entity_name": "CoinDCX",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 19.0760, "lng": 72.8777, "city": "Mumbai", "country": "India"},
        "offices": []
    },
    "CoinSwitch": {
        "entity_name": "CoinSwitch Kuber",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 12.9716, "lng": 77.5946, "city": "Bangalore", "country": "India"},
        "offices": []
    },
    "Kraken": {
        "entity_name": "Kraken",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 37.7749, "lng": -122.4194, "city": "San Francisco", "country": "USA"},
        "offices": [
            {"lat": 51.5074, "lng": -0.1278, "city": "London", "country": "UK"},
        ]
    },
    "OKX": {
        "entity_name": "OKX",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 1.3521, "lng": 103.8198, "city": "Singapore", "country": "Singapore"},
        "offices": [
            {"lat": 25.2048, "lng": 55.2708, "city": "Dubai", "country": "UAE"},
        ]
    },
    "Coinbase": {
        "entity_name": "Coinbase",
        "entity_type": "EXCHANGE",
        "headquarters": {"lat": 37.7749, "lng": -122.4194, "city": "San Francisco", "country": "USA"},
        "offices": [
            {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "USA"},
            {"lat": 51.5074, "lng": -0.1278, "city": "London", "country": "UK"},
        ]
    },
    "Uniswap": {
        "entity_name": "Uniswap (DEX)",
        "entity_type": "DEX",
        "headquarters": {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "USA"},
        "offices": []
    },
    "Tornado Cash": {
        "entity_name": "Tornado Cash (Mixer)",
        "entity_type": "MIXER",
        "headquarters": {"lat": 52.3676, "lng": 4.9041, "city": "Amsterdam", "country": "Netherlands"},
        "offices": []
    }
}

# Demo IP-to-geo mapping (simulated)
DEMO_IP_GEO = {
    "103.21.0.0": {"lat": 19.0760, "lng": 72.8777, "city": "Mumbai", "country": "India", "isp": "Reliance Jio"},
    "49.36.0.0": {"lat": 28.6139, "lng": 77.2090, "city": "New Delhi", "country": "India", "isp": "Airtel"},
    "104.16.0.0": {"lat": 37.7749, "lng": -122.4194, "city": "San Francisco", "country": "USA", "isp": "Cloudflare"},
    "52.84.0.0": {"lat": 39.0438, "lng": -77.4874, "city": "Ashburn", "country": "USA", "isp": "AWS"},
    "185.70.0.0": {"lat": 55.7558, "lng": 37.6173, "city": "Moscow", "country": "Russia", "isp": "DataLine"},
}


class GeolocationService:
    """Provides geolocation data for VASP entities and IP addresses."""

    @staticmethod
    def get_vasp_locations() -> List[Dict[str, Any]]:
        """Returns all known VASP locations with coordinates."""
        locations = []
        for name, data in VASP_LOCATIONS.items():
            hq = data["headquarters"]
            locations.append({
                "entity_name": data["entity_name"],
                "entity_type": data["entity_type"],
                "location_type": "headquarters",
                "latitude": hq["lat"],
                "longitude": hq["lng"],
                "city": hq["city"],
                "country": hq["country"]
            })
            for office in data.get("offices", []):
                locations.append({
                    "entity_name": data["entity_name"],
                    "entity_type": data["entity_type"],
                    "location_type": "office",
                    "latitude": office["lat"],
                    "longitude": office["lng"],
                    "city": office["city"],
                    "country": office["country"]
                })
        return locations

    @staticmethod
    def get_case_geo_data(db, case_id: str) -> Dict[str, Any]:
        """Returns geo data for all entities associated with a case."""
        from app.database.models import Case, Evidence, AddressLabel, EntityType

        case = db.query(Case).filter(Case.case_id == case_id).first()
        if not case:
            return {"error": "Case not found", "markers": []}

        markers = []
        vasp_matches = set()

        # Get evidence items and check for VASP matches
        evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
        for ev in evidence_items:
            for addr in [ev.from_address, ev.to_address]:
                label = db.query(AddressLabel).filter(
                    AddressLabel.address == addr.lower() if addr else ""
                ).first()
                if label and label.entity_type in [EntityType.VASP, EntityType.EXCHANGE]:
                    vasp_matches.add(label.entity_name)

        # Add VASP markers
        for vasp_name in vasp_matches:
            if vasp_name in VASP_LOCATIONS:
                data = VASP_LOCATIONS[vasp_name]
                hq = data["headquarters"]
                markers.append({
                    "entity_name": data["entity_name"],
                    "entity_type": data["entity_type"],
                    "latitude": hq["lat"],
                    "longitude": hq["lng"],
                    "city": hq["city"],
                    "country": hq["country"],
                    "marker_type": "vasp_match",
                    "case_id": case_id
                })

        # If no VASP matches found, add all known VASPs as reference
        if not markers:
            for name, data in list(VASP_LOCATIONS.items())[:5]:
                hq = data["headquarters"]
                markers.append({
                    "entity_name": data["entity_name"],
                    "entity_type": data["entity_type"],
                    "latitude": hq["lat"],
                    "longitude": hq["lng"],
                    "city": hq["city"],
                    "country": hq["country"],
                    "marker_type": "reference",
                    "case_id": case_id
                })

        return {
            "case_id": case_id,
            "case_title": case.title or case.complaint_reference,
            "blockchain": case.blockchain,
            "total_markers": len(markers),
            "vasp_matches": list(vasp_matches),
            "markers": markers
        }

    @staticmethod
    def ip_lookup(ip_address: str) -> Dict[str, Any]:
        """Resolves an IP address to geo coordinates (demo dataset)."""
        # Check demo dataset by prefix matching
        for prefix, data in DEMO_IP_GEO.items():
            if ip_address.startswith(prefix.split(".")[0]):
                return {
                    "ip_address": ip_address,
                    "resolved": True,
                    **data,
                    "source": "demo_dataset"
                }

        return {
            "ip_address": ip_address,
            "resolved": False,
            "lat": 0.0,
            "lng": 0.0,
            "city": "Unknown",
            "country": "Unknown",
            "isp": "Unknown",
            "source": "demo_dataset"
        }

    @staticmethod
    def get_jurisdiction_summary() -> List[Dict[str, Any]]:
        """Returns summary of VASP jurisdictions for cross-border analysis."""
        jurisdictions = {}
        for name, data in VASP_LOCATIONS.items():
            country = data["headquarters"]["country"]
            if country not in jurisdictions:
                jurisdictions[country] = {
                    "country": country,
                    "lat": data["headquarters"]["lat"],
                    "lng": data["headquarters"]["lng"],
                    "exchanges": [],
                    "count": 0
                }
            jurisdictions[country]["exchanges"].append(data["entity_name"])
            jurisdictions[country]["count"] += 1

        return list(jurisdictions.values())
