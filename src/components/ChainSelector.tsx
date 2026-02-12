import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { PresetsUtil } from '@/utils/PresetsUtil';
import { EIP155_RPCS_BY_CHAINS, EIP155_CHAINS } from '@/constants/Eip155';

interface ChainSelectorProps {
  selectedChainId: number;
  onSelect: (chainId: number) => void;
  supportedChainIds?: number[]; // Optional filter for specific chains
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  selectedChainId,
  onSelect,
  supportedChainIds,
}) => {
  const Theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Get all available chains or filter to supported ones
  const availableChainIds = supportedChainIds || Object.keys(EIP155_CHAINS).map(key => Number(key.split(':')[1]));

  // Get selected chain info
  const selectedChainKey = `eip155:${selectedChainId}`;
  const selectedChainInfo = EIP155_CHAINS[selectedChainKey];
  const selectedChainName = selectedChainInfo?.name || `Chain ${selectedChainId}`;
  const selectedChainLogo = PresetsUtil.getChainLogo(selectedChainKey);

  const handleSelectChain = (chainId: number) => {
    onSelect(chainId);
    setModalVisible(false);
  };

  return (
    <>
      {/* Selector Button */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          {
            backgroundColor: Theme['bg-150'],
            borderColor: Theme['bg-300'],
          },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          {selectedChainLogo && (
            <Image source={selectedChainLogo} style={styles.chainIcon} />
          )}
          <Text style={[styles.chainNameText, { color: Theme['fg-100'] }]}>
            {selectedChainName}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: Theme['fg-150'] }]}>▼</Text>
      </TouchableOpacity>

      {/* Chain Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Theme['bg-100'] },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: Theme['fg-100'] }]}>
              Select Network
            </Text>

            <ScrollView style={styles.chainList} showsVerticalScrollIndicator={false}>
              {availableChainIds.map((chainId) => {
                const chainKey = `eip155:${chainId}`;
                const chainInfo = EIP155_CHAINS[chainKey];
                const chainName = chainInfo?.name || `Chain ${chainId}`;
                const chainLogo = PresetsUtil.getChainLogo(chainKey);
                const isSelected = chainId === selectedChainId;

                return (
                  <TouchableOpacity
                    key={chainId}
                    style={[
                      styles.chainItem,
                      {
                        backgroundColor: isSelected
                          ? Theme['accent-glass-010']
                          : Theme['bg-125'],
                        borderColor: isSelected
                          ? Theme['accent-100']
                          : Theme['bg-200'],
                      },
                    ]}
                    onPress={() => handleSelectChain(chainId)}
                  >
                    {chainLogo && (
                      <Image source={chainLogo} style={styles.chainItemIcon} />
                    )}
                    <Text
                      style={[
                        styles.chainItemName,
                        {
                          color: isSelected ? Theme['accent-100'] : Theme['fg-100'],
                        },
                      ]}
                    >
                      {chainName}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.checkmark, { color: Theme['accent-100'] }]}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: Theme['bg-200'] },
              ]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: Theme['fg-100'] }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Selector button styles
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  chainIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chainNameText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    marginLeft: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  chainList: {
    maxHeight: 400,
  },
  chainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  chainItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
  },
  chainItemName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
