// HD photography from Unsplash, free to use under the Unsplash License (no attribution required;
// credited in the footer). Served through next/image; the ship is also used as a WebGL texture.
const unsplash = (id: string) => `https://images.unsplash.com/${id}`;

export const PHOTOS = {
  road: {
    src: unsplash('photo-1761133381018-aed5063d22fe'),
    alt: 'Aerial view of a white lorry on a country road between green fields',
    page: 'https://unsplash.com/photos/white-truck-driving-on-a-road-through-fields-LhgEKILDWTg',
  },
  sea: {
    src: unsplash('photo-1613690399151-65ea69478674'),
    alt: 'Aerial view of a container ship crossing deep blue water',
    page: 'https://unsplash.com/photos/aerial-view-of-boat-on-water-1cqIcrWFQBI',
  },
  rail: {
    src: unsplash('photo-1735480165299-3e0466547ed2'),
    alt: 'A red electric freight locomotive hauling a long line of wagons under overhead wires in Germany',
    page: 'https://unsplash.com/photos/a-red-train-traveling-down-train-tracks-next-to-a-forest-Andfr6852qA',
  },
  air: {
    src: unsplash('photo-1530545124313-ce5e8eae55af'),
    alt: 'An airliner flying towards the camera out of bright clouds',
    page: 'https://unsplash.com/photos/gray-and-white-airplane-on-flight-near-clear-blue-sky-PrdNTrIrG8w',
  },
} as const;
