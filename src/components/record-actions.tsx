import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ui';

export function RecordActions({ kind, onEdit, onDelete, hint }: {
  kind: 'peça' | 'look'; onEdit: () => void; onDelete: () => Promise<void>; hint: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError('');
    try { await onDelete(); }
    catch { setError('Não foi possível excluir. Tente novamente.'); }
    finally { busy.current = false; setDeleting(false); }
  }
  return <View style={styles.actions}>
    <ActionButton label={`Editar ${kind}`} icon="pencil-outline" onPress={onEdit} disabled={deleting} secondary />
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting} onPress={() => void remove()} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}>
      {deleting ? <ActivityIndicator color="#963D32" /> : <MaterialCommunityIcons name="trash-can-outline" size={20} color="#963D32" />}
      <Text style={styles.removeText}>{deleting ? 'Excluindo…' : `Excluir ${kind}`}</Text>
    </Pressable>
    <Text style={styles.hint}>{hint}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.removeText}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  remove: { minHeight: 52, borderWidth: 1, borderColor: '#E5C5BD', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14 },
  removeText: { color: '#963D32', fontSize: 15, fontWeight: '600' },
  hint: { color: '#69746C', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
