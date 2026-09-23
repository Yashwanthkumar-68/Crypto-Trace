import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Building, ShieldAlert } from 'lucide-react';

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const vaspIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface GeoMarker {
  entity_name: string;
  entity_type: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  marker_type: string;
  case_id: string;
}

interface GeoMapProps {
  caseId: string;
}

export const GeoMap: React.FC<GeoMapProps> = ({ caseId }) => {
  const [geoData, setGeoData] = useState<{ markers: GeoMarker[], vasp_matches: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('sih_auth_token')}` };
        const base = window.location.protocol === 'https:' ? '/api' : 'http://localhost:8000/api';
        const res = await fetch(`${base}/geo/case/${caseId}/map`, { headers });
        if (res.ok) {
          const data = await res.json();
          setGeoData(data);
        }
      } catch (e) {
        console.error('Failed to load geo data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchGeo();
  }, [caseId]);

  if (loading) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!geoData || geoData.markers.length === 0) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
        <MapPin className="w-12 h-12 mb-3 text-slate-300" />
        <p className="font-semibold text-sm">No geographic intelligence available</p>
        <p className="text-xs mt-1">Insufficient on-chain entity resolution to plot coordinates.</p>
      </div>
    );
  }

  // Calculate center based on markers
  const lats = geoData.markers.map(m => m.latitude);
  const lngs = geoData.markers.map(m => m.longitude);
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Building className="w-4 h-4 text-amber-500" />
          <span><strong className="text-slate-800">{geoData.vasp_matches.length}</strong> Target VASPs Identified</span>
        </div>
        {geoData.vasp_matches.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Extradition/Subpoena Jurisdictions Detected
          </div>
        )}
      </div>

      <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
        <MapContainer 
          center={[centerLat, centerLng]} 
          zoom={2} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {geoData.markers.map((marker, idx) => (
            <React.Fragment key={idx}>
              <Marker 
                position={[marker.latitude, marker.longitude]}
                icon={marker.marker_type === 'vasp_match' ? vaspIcon : defaultIcon}
              >
                <Popup>
                  <div className="text-sm font-sans">
                    <strong className="block text-base mb-1">{marker.entity_name}</strong>
                    <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 block mb-2 w-max">
                      {marker.entity_type}
                    </span>
                    <p className="text-slate-600 m-0 leading-tight">
                      {marker.city}, {marker.country}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 m-0 uppercase">
                      {marker.marker_type === 'vasp_match' ? 'Matched Case Entity' : 'Reference Node'}
                    </p>
                  </div>
                </Popup>
              </Marker>
              
              {marker.marker_type === 'vasp_match' && (
                <Circle 
                  center={[marker.latitude, marker.longitude]}
                  radius={500000} // 500km
                  pathOptions={{ color: 'red', fillColor: '#fca5a5', fillOpacity: 0.2, weight: 1 }}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};
