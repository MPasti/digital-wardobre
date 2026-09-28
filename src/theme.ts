import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F7F5EF',
    surface: '#FFFFFF',
    ink: '#28362F',
    muted: '#69746C',
    primary: '#365847',
    sage: '#E7ECE2',
    sand: '#EEE7D8',
    border: '#E1E5DC',
    white: '#FFFFFF',
  },
  fonts: {
    editorial: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  },
};
