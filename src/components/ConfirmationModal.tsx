import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  ImageSourcePropType,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  chainName: string;
  chainIcon?: ImageSourcePropType;
  recipient: string;
  amount: string;
  symbol: string;
  gasCost: string;
  total: string;
  amountUsd?: string;
  gasCostUsd?: string;
  totalUsd?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  chainName,
  chainIcon,
  recipient,
  amount,
  symbol,
  gasCost,
  total,
  amountUsd,
  gasCostUsd,
  totalUsd,
}) => {
  const Theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: Theme['bg-100'] },
          ]}
        >
          <Text style={[styles.title, { color: Theme['fg-100'] }]}>
            Review Transaction
          </Text>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Chain Display */}
            <View
              style={[
                styles.chainContainer,
                { backgroundColor: Theme['bg-150'], borderColor: Theme['bg-200'] },
              ]}
            >
              {chainIcon && <Image source={chainIcon} style={styles.chainIcon} />}
              <Text style={[styles.chainName, { color: Theme['fg-100'] }]}>
                {chainName}
              </Text>
            </View>

            {/* Transaction Details */}
            <View style={styles.detailsContainer}>
              {/* Amount */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: Theme['fg-150'] }]}>
                  You're sending
                </Text>
                <View style={styles.detailValueContainer}>
                  <Text style={[styles.detailValue, { color: Theme['fg-100'] }]}>
                    {amount} {symbol}
                  </Text>
                  {amountUsd && (
                    <Text style={[styles.detailValueUsd, { color: Theme['fg-150'] }]}>
                      ≈ ${amountUsd}
                    </Text>
                  )}
                </View>
              </View>

              {/* Recipient */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: Theme['fg-150'] }]}>
                  To
                </Text>
                <Text
                  style={[styles.detailValueMono, { color: Theme['fg-100'] }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {recipient}
                </Text>
              </View>

              {/* Gas Fee */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: Theme['fg-150'] }]}>
                  Network fee
                </Text>
                <View style={styles.detailValueContainer}>
                  <Text style={[styles.detailValue, { color: Theme['fg-100'] }]}>
                    {gasCost} {symbol}
                  </Text>
                  {gasCostUsd && (
                    <Text style={[styles.detailValueUsd, { color: Theme['fg-150'] }]}>
                      ≈ ${gasCostUsd}
                    </Text>
                  )}
                </View>
              </View>

              {/* Total Cost */}
              <View
                style={[
                  styles.detailRow,
                  styles.totalRow,
                  { borderTopColor: Theme['bg-200'] },
                ]}
              >
                <Text style={[styles.detailLabel, styles.totalLabel, { color: Theme['fg-100'] }]}>
                  Total cost
                </Text>
                <View style={styles.detailValueContainer}>
                  <Text
                    style={[styles.detailValue, styles.totalValue, { color: Theme['fg-100'] }]}
                  >
                    {total} {symbol}
                  </Text>
                  {totalUsd && (
                    <Text style={[styles.detailValueUsd, { color: Theme['fg-150'] }]}>
                      ≈ ${totalUsd}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: Theme['bg-200'] },
              ]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelButtonText, { color: Theme['fg-100'] }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: Theme['accent-100'] },
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmButtonText, { color: Theme['inverse-100'] }]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  chainIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContainer: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  detailValueContainer: {
    alignItems: 'flex-end',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailValueMono: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    textAlign: 'right',
  },
  detailValueUsd: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  totalRow: {
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    // Styles applied via theme
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    // Styles applied via theme
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
