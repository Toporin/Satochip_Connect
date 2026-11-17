import {ScrollView, StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {truncate} from '@/utils/HelperUtil';

interface Props {
  addresses: string[];
  selectedAddresses: Set<string>;
  onToggleAddress: (address: string) => void;
  /** Show the selection hint in the error colour (e.g. after Approve was pressed). */
  highlightHint?: boolean;
}

export function SelectableAddresses({addresses, selectedAddresses, onToggleAddress, highlightHint}: Props) {
  const Theme = useTheme();
  const hint =
    addresses.length === 0
      ? 'No account yet: add one in the Accounts tab first.'
      : selectedAddresses.size === 0
      ? 'Tap the address(es) to share with this app.'
      : undefined;

  return (
    <ScrollView
      bounces={false}
      style={[styles.container, {backgroundColor: Theme['bg-150']}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, {color: Theme['fg-150']}]}>
        Select Addresses ({selectedAddresses.size}/{addresses.length})
      </Text>
      {hint ? (
        <Text style={[styles.hint, {color: highlightHint ? Theme['error-100'] : Theme['fg-175']}]}>
          {hint}
        </Text>
      ) : null}
      <View style={styles.row}>
        {addresses.map(address => {
          const isSelected = selectedAddresses.has(address);
          const shortAddress = truncate(address, 15);
          const backgroundColor = isSelected
            ? Theme['accent-glass-020']
            : Theme['bg-250'];
          const textColor = isSelected
            ? Theme['accent-100']
            : Theme['fg-150'];

          return (
            <TouchableOpacity
              key={address}
              style={[styles.chip, {backgroundColor, borderColor: Theme['bg-300']}]}
              onPress={() => onToggleAddress(address)}>
              <Text style={[styles.chipText, {color: textColor}]}>
                {shortAddress}
              </Text>
            </TouchableOpacity>
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
  title: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    margin: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 4,
    marginBottom: 6,
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: {
    fontWeight: '500',
    fontSize: 12,
  },
});
