"use client";

import {
  MapContainer,
  TileLayer,
  useMapEvents
} from "react-leaflet";
import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode
} from "react";
import { MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude?: number;
  longitude?: number;
  onPositionChange?: (lat: number, lng: number) => void;
  onSelect?: (lat: number, lng: number) => void;
};

type TypedMapContainerProps = {
  center: [number, number];
  zoom: number;
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  style: CSSProperties;
  children: ReactNode;
};

type TypedTileLayerProps = {
  attribution: string;
  url: string;
};

type MapClickEvent = {
  latlng: {
    lat: number;
    lng: number;
  };
};

const TypedMapContainer = MapContainer as unknown as ComponentType<TypedMapContainerProps>;
const TypedTileLayer = TileLayer as unknown as ComponentType<TypedTileLayerProps>;

function MapController({
  latitude,
  longitude,
  onPositionChange,
  onMovingChange
}: {
  latitude: number;
  longitude: number;
  onPositionChange?: (lat: number, lng: number) => void;
  onMovingChange: (moving: boolean) => void;
}) {
  const map = useMapEvents({
    movestart() {
      onMovingChange(true);
    },
    moveend() {
      onMovingChange(false);
      const center = map.getCenter();
      onPositionChange?.(center.lat, center.lng);
    },
    click(event: MapClickEvent) {
      map.flyTo(event.latlng, Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.45
      });
    }
  });

  useEffect(() => {
    const center = map.getCenter();
    const changedExternally =
      Math.abs(center.lat - latitude) > 0.00001 ||
      Math.abs(center.lng - longitude) > 0.00001;

    if (changedExternally) {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.65
      });
    }
  }, [latitude, longitude, map]);

  return null;
}

export default function LocationPicker({
  latitude = 12.9352,
  longitude = 77.6245,
  onPositionChange,
  onSelect
}: Props) {
  const [isMoving, setIsMoving] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<[number, number]>([
    latitude,
    longitude
  ]);

  useEffect(() => {
    setSelectedPosition([latitude, longitude]);
  }, [latitude, longitude]);

  const handlePositionChange = (lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    onPositionChange?.(lat, lng);
  };

  return (
    <div className="location-pin-picker">
      <TypedMapContainer
        center={[latitude, longitude]}
        zoom={16}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TypedTileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController
          latitude={latitude}
          longitude={longitude}
          onPositionChange={handlePositionChange}
          onMovingChange={setIsMoving}
        />
      </TypedMapContainer>

      <div className={`location-center-pin ${isMoving ? "is-moving" : ""}`} aria-hidden="true">
        <span className="location-center-pin-icon">
          <MapPin size={27} strokeWidth={2.6} />
        </span>
        <span className="location-center-pin-shadow" />
      </div>

      <div className="location-map-instruction">Move map to adjust pin</div>

      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(selectedPosition[0], selectedPosition[1])}
          className="location-map-confirm"
        >
          Confirm Location
        </button>
      )}
    </div>
  );
}
