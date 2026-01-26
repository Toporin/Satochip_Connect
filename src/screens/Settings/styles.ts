import {StyleSheet} from 'react-native';
import { hp, windowHeight, windowWidth, wp } from '@/constants/responsive.tsx';

export default StyleSheet.create({
  // container: {
  //   flex: 1,
  // },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '50%',
    padding: 16,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    rowGap: 16,
  },
  content: {
    paddingHorizontal: 16,
  },
  smallMarginTop: {
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  sectionContainer: {
    rowGap: 8,
  },


  header: {
    flex: 1,
    paddingHorizontal: '5%',
    marginBottom: windowHeight > 850 ? 0 : '25%',
  },
  input: {
    marginVertical: '5%',
    marginHorizontal: '3%',
    paddingHorizontal: 15,
    width: wp(305),
    height: 50,
    borderRadius: 10,
    letterSpacing: 5,
    justifyContent: 'center',
    borderWidth: 1,
  },
  heading: {
    margin: '5%',
    padding: 5,
    width: windowWidth * 0.8,
    fontSize: 13,
    letterSpacing: 0.65,
  },
  btnContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
    paddingHorizontal: '3%',
    paddingTop: '5%',
  },
  checkInitialStatus: {
    fontSize: 13,
    textAlign: 'left',
    marginBottom: hp(30),
    marginLeft: hp(15),
    marginRight: wp(7),
  },
  warningContainer: {
    width: '100%',
    alignSelf: 'center',
    // marginTop: hp(20),
    paddingVertical: hp(17),
    paddingHorizontal: hp(9),
    borderWidth: 0.5,
    borderRadius: 8,
    flexDirection: 'row',
  },
  warningText: {
    fontSize: 13,
    textAlign: 'left',
    width: '80%',
    marginLeft: wp(10),
  },
  warningIcon: {
    width: wp(30),
    height: hp(30),
    marginTop: hp(5),
    marginHorizontal: hp(2),
  },
  statusText: {
    fontSize: 14,
    textAlign: 'left',
    marginLeft: wp(10),
    marginTop: wp(10),
  },
  infoIcon: {
    marginRight: wp(10),
  },
  illustration: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(20),
  },
  setupOptionsButton: {
    marginTop: hp(10),
  },
  modalOptionText: {
    fontSize: 14,
    letterSpacing: 0.65,
  },

  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
});
