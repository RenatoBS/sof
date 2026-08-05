import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Order, Product } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard, formatCurrency } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import {
  EntityAvatar,
  EntityCardBody,
  EntityCardFooter,
  EntityStat,
  entityCardStyles as ec,
} from '@/src/features/dashboard/EntityCard';
import { ProductFormModal } from '@/src/features/products/ProductFormModal';
import { d } from '@/src/theme/dashboard';

type Tab = 'catalog' | 'orders';

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

const NEXT_STATUS: Record<string, Array<Order['status']>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export default function ProductsScreen() {
  const { products, setProducts } = useDashboard();
  const [tab, setTab] = useState<Tab>('catalog');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await dashboardApi.orders();
      setOrders(res.orders);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'orders') loadOrders().catch(() => undefined);
  }, [tab, loadOrders]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const startCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const onSaved = (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists
        ? prev.map((p) => (p.id === product.id ? product : p))
        : [...prev, product];
    });
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (editing?.id === id) closeModal();
  };

  const setOrderStatus = async (
    order: Order,
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
  ) => {
    const { order: updated } = await dashboardApi.updateOrderStatus(
      order.id,
      status,
    );
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <View style={ec.page}>
      <SofPageHeader
        title="Produtos"
        subtitle="Catálogo e pedidos pelo WhatsApp"
        action={
          tab === 'catalog' ? (
            <SofButton
              title="Adicionar produto"
              variant="dark"
              theme="dashboard"
              onPress={startCreate}
            />
          ) : undefined
        }
      />

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'catalog' && styles.tabActive]}
          onPress={() => setTab('catalog')}
        >
          <Text style={[styles.tabText, tab === 'catalog' && styles.tabTextActive]}>
            Catálogo
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'orders' && styles.tabActive]}
          onPress={() => setTab('orders')}
        >
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>
            Pedidos
          </Text>
        </Pressable>
      </View>

      {tab === 'catalog' ? (
        <>
          {products.length > 0 ? (
            <Text style={ec.count}>
              {products.length}{' '}
              {products.length === 1 ? 'produto' : 'produtos'}
            </Text>
          ) : null}

          {products.length === 0 ? (
            <SofCard padded={false}>
              <SofEmptyState
                title="Nenhum produto ainda"
                body="Cadastre produtos para o bot vender pelo WhatsApp (pedido sem pagamento online)."
                action={
                  <SofButton
                    title="Adicionar produto"
                    variant="dark"
                    theme="dashboard"
                    onPress={startCreate}
                  />
                }
              />
            </SofCard>
          ) : (
            <View style={ec.grid}>
              {products.map((p) => {
                const thumb = p.images?.[0];
                return (
                  <SofCard key={p.id} padded={false} style={ec.entity}>
                    <EntityCardBody>
                      <View style={styles.head}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.thumb} />
                        ) : (
                          <EntityAvatar name={p.name} color={d.accent} />
                        )}
                        <View style={styles.headCopy}>
                          <Text style={styles.name} numberOfLines={2}>
                            {p.name}
                          </Text>
                          {!p.active ? (
                            <Text style={styles.inactive}>Inativo no bot</Text>
                          ) : null}
                          {p.handoffEnabled ? (
                            <Text style={styles.handoff}>Handoff ao vender</Text>
                          ) : null}
                          {p.paymentLinkUrl ? (
                            <Text style={styles.inactive}>Com link de pagamento</Text>
                          ) : null}
                        </View>
                      </View>
                      {p.description ? (
                        <Text style={styles.desc} numberOfLines={2}>
                          {p.description}
                        </Text>
                      ) : null}
                      <View style={styles.stats}>
                        <EntityStat label="Preço" value={formatCurrency(p.price)} />
                        <EntityStat
                          label="Estoque"
                          value={p.stock == null ? 'Ilimitado' : String(p.stock)}
                        />
                      </View>
                    </EntityCardBody>
                    <EntityCardFooter>
                      <SofRowActions
                        onEdit={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        onRemove={() => remove(p.id)}
                      />
                    </EntityCardFooter>
                  </SofCard>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <>
          {ordersLoading ? (
            <Text style={styles.muted}>Carregando pedidos…</Text>
          ) : orders.length === 0 ? (
            <SofCard padded={false}>
              <SofEmptyState
                title="Nenhum pedido"
                body="Pedidos feitos pelo WhatsApp aparecem aqui."
              />
            </SofCard>
          ) : (
            <View style={styles.orderList}>
              {orders.map((o) => (
                <SofCard key={o.id}>
                  <Text style={styles.orderTitle}>
                    {o.clientName || 'Cliente'} · {formatCurrency(o.total)}
                  </Text>
                  <Text style={styles.muted}>
                    {ORDER_STATUS_LABEL[o.status] || o.status}
                    {o.clientPhone ? ` · ${o.clientPhone}` : ''}
                  </Text>
                  {(o.items || []).map((item) => (
                    <Text key={item.id} style={styles.orderItem}>
                      {item.quantity}× {item.productName} (
                      {formatCurrency(item.lineTotal)})
                    </Text>
                  ))}
                  <View style={styles.orderActions}>
                    {(NEXT_STATUS[o.status] || []).map((status) => (
                      <SofButton
                        key={String(status)}
                        title={ORDER_STATUS_LABEL[status] || String(status)}
                        variant={status === 'cancelled' ? 'danger' : 'light'}
                        theme="dashboard"
                        onPress={() =>
                          setOrderStatus(
                            o,
                            status as
                              | 'pending'
                              | 'confirmed'
                              | 'cancelled'
                              | 'completed',
                          )
                        }
                      />
                    ))}
                  </View>
                </SofCard>
              ))}
            </View>
          )}
        </>
      )}

      <ProductFormModal
        visible={modalOpen}
        onClose={closeModal}
        product={editing}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: d.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: d.surface,
  },
  tabActive: { backgroundColor: d.ink, borderColor: d.ink },
  tabText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  tabTextActive: { color: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: d.surface,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
  },
  desc: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  inactive: { color: d.muted, fontSize: 12, fontFamily: d.fonts.body },
  handoff: { color: d.accent, fontSize: 12, fontFamily: d.fonts.body },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  muted: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  orderList: { gap: 12 },
  orderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  orderItem: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body, marginTop: 4 },
  orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
