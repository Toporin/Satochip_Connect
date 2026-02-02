export const getMetadata = () => {
  return {
    name: 'Satochip Connect',
    description: 'Satochip Connect wallet',
    url: 'https://satochip.io',
    icons: ['https://avatars.githubusercontent.com/u/10826856'],
    redirect: {
      native: 'satochip-connect-internal://',
      universal: 'https://satochip.io/satochip_connect_internal',
      linkMode: true,
    },
  };
};
