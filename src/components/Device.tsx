import { FC, SVGProps } from "react";
import { styled } from "linaria/react";

import Heartrate from "../icons/hr_icon2.svg";
import Flex from "./Flex";
import Text from "./Text";
import { DeviceStatus } from "../modules/types";
import { capitalise } from "../utils";
import { deviceStatusToColor, deviceStatusToColorName } from "../theme";

const mapStatus = ({ status }: { status: DeviceStatus }) =>
  deviceStatusToColor(status);

const Container = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  max-width: 36rem;
  border: 0.2rem solid ${mapStatus};
  border-radius: 0.4rem;
  padding: 1.2rem 1.6rem;
`;

const IconContainer = styled.div`
  font-size: 4rem;
  line-height: 1em;
  color: ${mapStatus};
`;

export type IconName = "heartrate";

export type DeviceProps = {
  icon: IconName;
  name: string;
  status: DeviceStatus;
  value?: number | string;
  onClick?: () => void;
};

export type PlaceholderProps = {
  name: string;
  icon: IconName;
};

const icons: Record<IconName, FC<SVGProps<SVGSVGElement>>> = {
  heartrate: Heartrate,
};

const Device: FC<DeviceProps> = ({ icon, name, status, value, onClick }) => {
  const Icon = icons[icon];
  return (
    <Container onClick={onClick} status={status}>
      <Flex direction="row" align="flex-start" justify="space-between">
        <IconContainer status={status}>
          <Icon />
        </IconContainer>
        <Flex align="flex-end">
          <Text margin={[0, 0, 1]}>{name}</Text>
          <Text color="secondary">{capitalise(status)}</Text>
        </Flex>
      </Flex>
      <Flex align="center">
        <Text color={deviceStatusToColorName(status)} margin={[1, 0, 0]}>
          {status === "offline" ? "Tap to connect" : value}
        </Text>
      </Flex>
    </Container>
  );
};

export default Device;
