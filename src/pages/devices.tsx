import { NextPage } from "next";
import { styled } from "linaria/react";
import { useSelector } from "react-redux";

import * as devices from "../modules/devices";
import * as heartrate from "../modules/heartrate";

import Header from "../components/Header";
import Container from "../components/Container";
import Bluetooth from "../icons/bluetooth.svg";
import Device from "../components/Device";

const Screen = styled.section`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Heading = styled.header`
  display: flex;
  align-items: center;
  font-size: 1.6rem;
  padding: 0.4rem 0;
`;

const Text = styled.p`
  padding: 0 1rem;
  line-height: 1em;
`;

const Status = styled.p`
  color: ${({ available }: { available: boolean }) =>
    available ? "#5cdc5c" : "grey"};

  line-height: 1em;
`;

const DeviceList = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
`;

const Devices: NextPage = () => {
  const bluetoothAvailable = useSelector(devices.selectors.bleAvailable);
  const { connect, status, name, value } = heartrate.useDevice();
  return (
    <Container>
      <Header title="Devices" />
      <Screen>
        <Heading>
          <Status available={bluetoothAvailable}>
            <Bluetooth />
          </Status>
          <Text>Bluetooth </Text>
          <Status available={bluetoothAvailable}>
            {bluetoothAvailable ? "On" : "Not available"}
          </Status>
        </Heading>
        <DeviceList>
          <Device
            name={name}
            icon="heartrate"
            status={status}
            value={value}
            onClick={connect}
          />
        </DeviceList>
      </Screen>
    </Container>
  );
};

export default Devices;
