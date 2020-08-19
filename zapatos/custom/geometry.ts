
type Coordinate = [number, number] | [number, number, number];

interface Point {
  type: 'Point';
  coordinates: Coordinate;
}

interface MultiPoint {
  type: 'MultiPoint';
  coordinates: Coordinate[];
}

interface LineString {
  type: 'LineString';
  coordinates: Coordinate[];
}

interface MultiLineString {
  type: 'MultiLineString';
  coordinates: Coordinate[][];
}

interface Polygon {
  type: 'Polygon';
  coordinates: Coordinate[][];
}

interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: Coordinate[][][];
}

type geometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon;

export default geometry;
