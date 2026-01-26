import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useTheme} from '@/hooks/useTheme';
import { truncate } from '@/utils/HelperUtil.ts';

interface Props {
  addresses?: string[];
}

export function Addresses({addresses}: Props) {
  const Theme = useTheme();

  return (
    <ScrollView
      bounces={false}
      style={[styles.container, {backgroundColor: Theme['bg-150']}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, {color: Theme['fg-150']}]}>
        {addresses && addresses.length > 1 ? "Addresses" : "Address"}
      </Text>
      <View style={styles.row}>
        {addresses?.map(address => {
          // const logo = PresetsUtil.getChainLogo(`${chain.namespace}:${chain.chainId}`);
          const shortAddress = truncate(address, 15);
          return (
            <View
              key={address}
              style={[styles.chain, {borderColor: Theme['bg-300']}]}>
              <Text style={[styles.chainName, {color: Theme['fg-150']}]}>{shortAddress}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    maxHeight: 120,
  },
  content: {
    padding: 8,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  chainLogo: {
    height: 18,
    width: 18,
    borderRadius: 100,
  },
  chainName: {
    fontWeight: '500',
    fontSize: 12,
  },
  title: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    margin: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 8,
    paddingHorizontal: 4,
  },
  chain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
  },
});
