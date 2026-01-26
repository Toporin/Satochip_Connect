import {utils} from 'ethers';
import {ProposalTypes} from '@walletconnect/types';
import {PresetsUtil} from './PresetsUtil';

/**
 * Truncates string (in the middle) via given length value
 */
export function truncate(value: string, length: number) {
  if (value?.length <= length) {
    return value;
  }

  const separator = '...';
  const stringLength = length - separator.length;
  const frontLength = Math.ceil(stringLength / 2);
  const backLength = Math.floor(stringLength / 2);

  return (
    value.substring(0, frontLength) +
    separator +
    value.substring(value.length - backLength)
  );
}

/**
 * Converts hex to utf8 string if it is valid bytes
 */
export function convertHexToUtf8(value: string) {
  if (utils.isHexString(value)) {
    return utils.toUtf8String(value);
  }

  return value;
}

/**
 * Gets message from various signing request methods by filtering out
 * a value that is not an address (thus is a message).
 * If it is a hex string, it gets converted to utf8 string
 */
export function getSignParamsMessage(params: string[]) {
  const message = params.filter(p => !utils.isAddress(p))[0];

  return convertHexToUtf8(message);
}

/**
 * Gets data from various signTypedData request methods by filtering out
 * a value that is not an address (thus is data).
 * If data is a string convert it to object
 */
export function getSignTypedDataParamsData(params: string[]) {
  const data = params.filter(p => !utils.isAddress(p))[0];

  return JSON.parse(data);
}

/**
 * Extract addresses from WalletConnect params
 */
export function getEIP155AddressesFromParams(params: any): string {

  const method = params.request.method;

  // todo: manage all possible cases
  switch (method) {

    case "eth_sign":
      return params.request.params[0];

    case "personal_sign":
      return params.request.params[1];

    case "eth_signTypedData":
    case "eth_signTypedData_V3":
    case "eth_signTypedData_v4":
      return params.request.params[0];

    case "eth_signTransaction":
    case "eth_sendTransaction":
      return params.request.params[0].from;

    default:
      return '';
  }
}

/**
 * Get Wallet supported chains
 */
export function getSupportedChains(
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
) {
  if (!requiredNamespaces && !optionalNamespaces) {
    return [];
  }

  const required = [];
  for (const [key, values] of Object.entries(requiredNamespaces)) {
    const chains = key.includes(':') ? key : values.chains;
    if (chains) {
      required.push(chains);
    }
  }

  const optional = [];
  for (const [key, values] of Object.entries(optionalNamespaces)) {
    const chains = key.includes(':') ? key : values.chains;
    if (chains) {
      optional.push(chains);
    }
  }

  const chains = [...required.flat(), ...optional.flat()];

  return chains
    .map(chain => PresetsUtil.getChainData(chain))
    .filter(chain => chain !== undefined);
}
