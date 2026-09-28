export const clothingCategories = [
  { id: 'all', label: 'Todas' },
  { id: 'tops', label: 'Parte de cima' },
  { id: 'bottoms', label: 'Parte de baixo' },
  { id: 'one-piece', label: 'Peça única' },
  { id: 'shoes', label: 'Calçados' },
  { id: 'accessories', label: 'Acessórios' },
] as const;

export type ClothingFilter = (typeof clothingCategories)[number]['id'];
export type ClothingCategory = Exclude<ClothingFilter, 'all'>;

export const clothingColors = [
  { label: 'Preto', hex: '#303332' }, { label: 'Branco', hex: '#FFFFFF' },
  { label: 'Cinza', hex: '#929894' }, { label: 'Bege', hex: '#D9C4A0' },
  { label: 'Marrom', hex: '#896048' }, { label: 'Azul', hex: '#577EA8' },
  { label: 'Verde', hex: '#6A8A68' }, { label: 'Vermelho', hex: '#BB625A' },
  { label: 'Rosa', hex: '#D49CAC' }, { label: 'Amarelo', hex: '#D6B856' },
  { label: 'Roxo', hex: '#9481AD' }, { label: 'Laranja', hex: '#D88D56' },
] as const;

export type ClothingItem = {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  notes?: string;
  localPhotoPath?: string;
  localPhotoUri?: string;
  remotePhotoPath?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
};

export type Outfit = {
  id: string;
  name: string;
  occasion?: string;
  clothingIds: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
};
