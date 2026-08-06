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
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
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
    setPaymentLinkUrl(product?.paymentLinkUrl || '');
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
        paymentLinkUrl: paymentLinkUrl.trim(),
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
      <SofInput
        label="Link de pagamento (opcional)"
        value={paymentLinkUrl}
        onChangeText={setPaymentLinkUrl}
        theme="dashboard"
        placeholder="https://… (Pix, Mercado Pago, etc.)"
        autoCapitalize="none"
      />
      <Text style={styles.hint}>
        A Sof só envia este link no WhatsApp após o pedido — não cria cobrança na
        Stripe.
      </Text>

      <Text style={styles.label}>Imagens (até {MAX_IMAGES})</Text>
      <View style={styles.thumbs}>
        {images.map((uri, idx) => (
          <View key={`${idx}-${uri.slice(0, 24)}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable
              onPress={() =>
                setImages((prev) => prev.filter((_, i) => i !== idx))
              }
              style={styles.thumbRemove}
              accessibilityLabel="Remover imagem"
            >
              <Text style={styles.thumbRemoveText}>×</Text>
            </Pressable>
          </View>
        ))}
        {images.length < MAX_IMAGES ? (
          <Pressable
            onPress={pickImages}
            disabled={imageBusy}
            accessibilityRole="button"
            accessibilityLabel="Adicionar imagens"
            style={({ pressed }) => [
              styles.addImage,
              imageBusy && styles.addImageBusy,
              pressed && !imageBusy && styles.addImagePressed,
            ]}
          >
            <Text style={styles.addImagePlus}>+</Text>
            <Text style={styles.addImageText}>
              {imageBusy ? 'Processando…' : 'Adicionar'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.label}>Opções</Text>
      <Pressable
        onPress={() => setHandoffEnabled((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: handoffEnabled }}
        style={[styles.optionRow, handoffEnabled && styles.optionRowOn]}
      >
        <View style={styles.optionCopy}>
          <Text
            style={[styles.optionTitle, handoffEnabled && styles.optionTitleOn]}
          >
            Abrir handoff ao vender
          </Text>
          <Text
            style={[styles.optionHint, handoffEnabled && styles.optionHintOn]}
          >
            Após o pedido, a Sof chama a equipe no WhatsApp
          </Text>
        </View>
        <View style={[styles.switchTrack, handoffEnabled && styles.switchTrackOn]}>
          <View
            style={[styles.switchThumb, handoffEnabled && styles.switchThumbOn]}
          />
        </View>
      </Pressable>
      <Pressable
        onPress={() => setActive((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: active }}
        style={[styles.optionRow, active && styles.optionRowOn]}
      >
        <View style={styles.optionCopy}>
          <Text style={[styles.optionTitle, active && styles.optionTitleOn]}>
            Ativo no bot
          </Text>
          <Text style={[styles.optionHint, active && styles.optionHintOn]}>
            Aparece na lista de produtos do WhatsApp
          </Text>
        </View>
        <View style={[styles.switchTrack, active && styles.switchTrackOn]}>
          <View style={[styles.switchThumb, active && styles.switchThumbOn]} />
        </View>
      </Pressable>
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
    marginTop: 4,
    marginBottom: 8,
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
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
    zIndex: 1,
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  addImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: d.line,
    borderStyle: 'dashed',
    backgroundColor: d.fill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addImageBusy: { opacity: 0.55 },
  addImagePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  addImagePlus: {
    fontSize: 22,
    lineHeight: 24,
    color: d.ink,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
  },
  addImageText: {
    fontSize: 11,
    color: d.mutedStrong,
    fontFamily: d.fonts.bodyMedium,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: d.surface,
    marginBottom: 8,
  },
  optionRowOn: {
    backgroundColor: d.accentSoft,
    borderColor: d.ink,
  },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionTitle: {
    color: d.ink,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
  },
  optionTitleOn: { color: d.ink },
  optionHint: {
    color: d.muted,
    fontSize: 12,
    fontFamily: d.fonts.body,
    lineHeight: 16,
  },
  optionHintOn: { color: d.mutedStrong },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: d.fill,
    borderWidth: 1,
    borderColor: d.line,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: d.ink,
    borderColor: d.ink,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: d.line,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
    borderColor: 'transparent',
  },
  hint: {
    color: d.muted,
    fontSize: 12,
    fontFamily: d.fonts.body,
    marginBottom: 12,
  },
});
