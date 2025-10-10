import { Look, Model } from './types';

export const INITIAL_MODELS: Omit<Model, 'id'>[] = [
  {
    name: 'Sofia',
    imageUrl: 'https://storage.googleapis.com/maker-me-space-8955/images/1582e389-014b-4c3e-a131-9a706599b4a4-source.jpeg',
    gender: 'Female',
    ethnicity: 'Caucasian',
    ageAppearance: '20s',
    height: '171-175 cm',
    skinTone: 'Fair',
    hairColor: 'Brown',
    bodyShape: 'Slim',
    hairStyle: 'Long',
    facialHair: 'None',
  },
  {
    name: 'Kenji',
    imageUrl: 'https://storage.googleapis.com/maker-me-space-8955/images/13c6b65f-4613-4a18-8f5b-9d4133b3a726-source.jpeg',
    gender: 'Male',
    ethnicity: 'Asian',
    ageAppearance: '20s',
    height: '176-180 cm',
    skinTone: 'Light',
    hairColor: 'Black',
    bodyShape: 'Athletic',
    hairStyle: 'Short',
    facialHair: 'None',
  }
];
