/*
** Please do edit this file as needed **
It's a placeholder for a custom type definition
*/

declare module 'zapatos/custom' {
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

  export type PgGeometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon;
}