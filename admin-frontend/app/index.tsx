import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAdminAuth } from '@/src/auth/AdminAuthProvider';
import { colors } from '@/src/theme/admin';

export default function Index() {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={admin ? '/accounts' : '/login'} />;
}
