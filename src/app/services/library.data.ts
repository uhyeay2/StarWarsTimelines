import { LibraryItem } from '../models/library-item';
import { Medium } from '../models/medium';

export interface CatalogMaterial {
  id: string;
  title: string;
  medium: Medium;
}

export const SOURCE_MATERIAL_CATALOG: readonly CatalogMaterial[] = [
  { id: 'material-episode-i', title: 'Star Wars: Episode I - The Phantom Menace', medium: 'Movie' },
  { id: 'material-episode-ii', title: 'Star Wars: Episode II - Attack of the Clones', medium: 'Movie' },
  { id: 'material-episode-iii', title: 'Star Wars: Episode III - Revenge of the Sith', medium: 'Movie' },
  { id: 'material-episode-iv', title: 'Star Wars: Episode IV - A New Hope', medium: 'Movie' },
  { id: 'material-episode-v', title: 'Star Wars: Episode V - The Empire Strikes Back', medium: 'Movie' },
  { id: 'material-episode-vi', title: 'Star Wars: Episode VI - Return of the Jedi', medium: 'Movie' },
  { id: 'material-episode-vii', title: 'Star Wars: Episode VII - The Force Awakens', medium: 'Movie' },
  { id: 'material-episode-viii', title: 'Star Wars: Episode VIII - The Last Jedi', medium: 'Movie' },
  { id: 'material-episode-ix', title: 'Star Wars: Episode IX - The Rise of Skywalker', medium: 'Movie' },
  { id: 'material-clone-wars', title: 'Star Wars: The Clone Wars', medium: 'Animated Show' },
  { id: 'material-rebels', title: 'Star Wars: Rebels', medium: 'Animated Show' },
  { id: 'material-mandalorian', title: 'The Mandalorian', medium: 'Live Action Show' },
  { id: 'material-ahsoka', title: 'Ahsoka', medium: 'Live Action Show' },
  { id: 'material-dawn-of-the-jedi', title: 'Dawn of the Jedi', medium: 'Comic' },
  { id: 'material-revan', title: 'The Old Republic: Revan', medium: 'Book' },
  { id: 'material-darth-bane', title: 'Darth Bane: Path of Destruction', medium: 'Book' },
  { id: 'material-darth-plagueis', title: 'Darth Plagueis', medium: 'Book' },
  { id: 'material-light-of-the-jedi', title: 'The High Republic: Light of the Jedi', medium: 'Book' },
  { id: 'material-shatterpoint', title: 'Shatterpoint', medium: 'Book' },
  { id: 'material-legacy-betrayal', title: 'Legacy of the Force: Betrayal', medium: 'Book' },
  { id: 'material-kotor', title: 'Star Wars: Knights of the Old Republic', medium: 'Video Game' },
  { id: 'material-jedi-fallen-order', title: 'Star Wars Jedi: Fallen Order', medium: 'Video Game' },
];

export interface LibrarySeedData {
  items: readonly LibraryItem[];
}

export const LIBRARY_SEEDS: Record<string, LibrarySeedData> = {
  'user-padme': {
    items: [
      {
        id: 'material-episode-i',
        title: 'Star Wars: Episode I - The Phantom Menace',
        medium: 'Movie',
        status: 'Completed',
        favorite: true,
      },
      {
        id: 'material-episode-ii',
        title: 'Star Wars: Episode II - Attack of the Clones',
        medium: 'Movie',
        status: 'In progress',
        favorite: false,
      },
      {
        id: 'material-darth-bane',
        title: 'Darth Bane: Path of Destruction',
        medium: 'Book',
        status: 'Completed',
        favorite: true,
      },
      {
        id: 'material-clone-wars',
        title: 'Star Wars: The Clone Wars',
        medium: 'Animated Show',
        status: 'In progress',
        favorite: false,
      },
      {
        id: 'material-episode-ix',
        title: 'Star Wars: Episode IX - The Rise of Skywalker',
        medium: 'Movie',
        status: 'Wish Listed',
        favorite: false,
      },
      {
        id: 'material-darth-plagueis',
        title: 'Darth Plagueis',
        medium: 'Book',
        status: 'Wish Listed',
        favorite: false,
      },
      {
        id: 'material-kotor',
        title: 'Star Wars: Knights of the Old Republic',
        medium: 'Video Game',
        status: 'Wish Listed',
        favorite: false,
      },
    ],
  },
  'user-luke': {
    items: [
      {
        id: 'material-episode-iv',
        title: 'Star Wars: Episode IV - A New Hope',
        medium: 'Movie',
        status: 'Completed',
        favorite: true,
      },
      {
        id: 'material-episode-v',
        title: 'Star Wars: Episode V - The Empire Strikes Back',
        medium: 'Movie',
        status: 'Completed',
        favorite: true,
      },
    ],
  },
  'user-rey': {
    items: [],
  },
};
