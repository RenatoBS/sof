import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Product } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import { fileToImageDataUrl } from '@/src/lib/logo';
import { d } from '@/src/theme/dashboard';

const MAX_IMAGES = 5;

type ProductFormModalProps = {
  visible: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved: (product: Product) => void;
};

export function ProductFormModal({
  visible,
  onClose,
  product = null,
  onSaved,
}: ProductFormModalProps) {
  const isEditing = Boolean(product);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('50');
  const [stock, setStock] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [handoffEnabled, setHandoffEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(product?.name || '');
    setDescription(product?.description || '');
    setPrice(String(product?.price ?? 50));
    setStock(product?.stock == null ? '' : String(product.stock));
    setImages(product?.images || []);
    setHandoffEnabled(Boolean(product?.handoffEnabled));
    setActive(product?.active !== false);
    setError('');
    setLoading(false);
    setImageBusy(false);
  }, [visible, product]);

  const pickImages = () => {
    if (Platform.OS !== 'web') {
      setError('Upload de imagens disponível no painel web por enquanto.');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setError(`No máximo ${MAX_IMAGES} imagens.`);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      setImageBusy(true);
      setError('');
      try {
        const next = [...images];
        for (const file of files) {
          if (next.length >= MAX_IMAGES) break;
          next.push(await fileToImageDataUrl(file));
        }
        setImages(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao ler imagem.');
      } finally {
        setImageBusy(false);
      }
    };
    input.click();
  };

  const save = async () => {
    setError('');
    setLoading(true);
    try {
      const stockTrim = stock.trim();
      const body = {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        images,
        stock: stockTrim === '' ? null : parseInt(stockTrim, 10),
        handoffEnabled,
        active,
      };
      const { product: saved } = product
        ? await dashboardApi.updateProduct(product.id, body)
        : await dashboardApi.createProduct(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title={isEditing ? 'Editar produto' : 'Novo produto'}
      actions={
        <>
          <SofButton
            title={loading ? 'Salvando…' : 'Salvar'}
            variant="dark"
            theme="dashboard"
            onPress={save}
            loading={loading}
            disabled={loading || imageBusy}
          />
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            onPress={onClose}
            disabled={loading}
          />
        </>
      }
    >
      <SofInput
        label="Nome do produto"
        value={name}
        onChangeText={setName}
        theme="dashboard"
        placeholder="Ex: Pomada modeladora"
      />
      <SofInput
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        theme="dashboard"
        placeholder="Detalhes, tamanho, uso…"
      />
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <SofInput
            label="Preço (R$)"
            value={price}
            onChangeText={setPrice}
            theme="dashboard"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.formCol}>
          <SofInput
            label="Estoque (vazio = ilimitado)"
            value={stock}
            onChangeText={setStock}
            theme="dashboard"
            keyboardType="numeric"
            placeholder="Opcional"
          />
        </View>
      </View>

      <Text style={styles.label}>Imagens (até {MAX_IMAGES})</Text>
      <View style={styles.thumbs}>
        {images.map((uri, idx) => (
          <View key={`${idx}-${uri.slice(0, 24)}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable
              onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
              style={styles.thumbRemove}
              accessibilityLabel="Remover imagem"
            >
              <Text style={styles.thumbRemoveText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <SofButton
        title={imageBusy ? 'Processando…' : 'Adicionar imagens'}
        variant="light"
        theme="dashboard"
        onPress={pickImages}
        disabled={imageBusy || images.length >= MAX_IMAGES}
        loading={imageBusy}
      />

      <View style={styles.toggles}>
        <Pressable
          style={[styles.toggle, handoffEnabled && styles.toggleOn]}
          onPress={() => setHandoffEnabled((v) => !v)}
        >
          <Text style={[styles.toggleText, handoffEnabled && styles.toggleTextOn]}>
            Abrir handoff ao vender
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, active && styles.toggleOn]}
          onPress={() => setActive((v) => !v)}
        >
          <Text style={[styles.toggleText, active && styles.toggleTextOn]}>
            Ativo no bot
          </Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Com handoff ligado, a Sof registra o pedido e chama a equipe no WhatsApp.
      </Text>
      {error ? <SofErrorBanner message={error} /> : null}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  formCol: { flexGrow: 1, flexBasis: 140, minWidth: 120 },
  label: {
    color: d.ink,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
  },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: d.fill,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: d.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: d.surface,
  },
  toggleOn: { backgroundColor: d.ink, borderColor: d.ink },
  toggleText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  toggleTextOn: { color: '#fff' },
  hint: { color: d.muted, fontSize: 12, fontFamily: d.fonts.body },
});
