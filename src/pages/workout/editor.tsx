import { useCallback, ChangeEvent, FC } from "react";
import { NextPage } from "next";
import { styled } from "linaria/react";

import { hooks } from "../../modules/workoutEditor";
import WorkoutVisualizer, {
  BoardVisualizer,
} from "../../components/WorkoutVisualizer";
import Modal from "../../components/Modal";
import Overlay from "../../components/Overlay";
import Box from "../../components/Box";
import { getZoneName, average, capitalise, zoneToColor } from "../../utils";

const Container = styled.div`
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
`;

const Input = styled.input`
  padding: 1rem;
  font-size: 2rem;
  background: none;
  border: none;
  color: white;
  :focus {
    outline: none;
    color: yellow;
  }
`;

type TextProps = {
  size?: number;
  color?: string;
};

const Text = styled.span`
  padding: 1rem;
  font-size: ${({ size = 1 }: TextProps) => `${size}rem`};
  color: ${({ color = "white" }: TextProps) => color};
`;

const Button = styled.button`
  background-color: ${({
    variant,
  }: {
    variant: "primary" | "success" | "danger";
  }) =>
    ({ primary: "#ffffff", success: "#a3f2a3", danger: "#fc9999" }[variant])};
  color: black;
  border: none;
  border-radius: 9999rem;
  padding: 1.2rem 2rem;
  font-size: 1.8rem;
  margin-right: 1rem;
  box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.2);

  &:last-of-type {
    margin: 0;
  }
`;

const Toolbar = styled.aside`
  display: flex;
  justify-content: flex-end;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 2rem;
`;

const Stats = styled.div`
  background-color: rgba(25, 25, 25, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
`;

const SectionModal: FC = () => {
  const section = hooks.section();
  const createInterval = hooks.createInterval();
  const addSection = hooks.addSection();
  const updateSectionName = hooks.updateSectionName();
  const cancelSection = hooks.cancelSection();
  const handleSectionNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSectionName(event.target.value);
    },
    [updateSectionName]
  );

  if (!section) {
    return null;
  }

  return (
    <Overlay align="bottom">
      <Modal>
        <Input
          value={section.name}
          onChange={handleSectionNameChange}
          placeholder="Name this section..."
        />
        <Box height={40}>
          <WorkoutVisualizer intervals={section.intervals} />
        </Box>
        <Box direction="row" justify="flex-end">
          <Button variant="danger" onClick={cancelSection}>
            Cancel
          </Button>
          <Button variant="success" onClick={addSection}>
            Add
          </Button>
          <Button variant="primary" onClick={createInterval}>
            + Interval
          </Button>
        </Box>
      </Modal>
    </Overlay>
  );
};

const useNumericInput = (setter: (value: number) => void, modifier = 1) => {
  return useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.value !== "" ? parseInt(event.target.value, 10) : 0;
      if (!Number.isNaN(value)) {
        setter(value * modifier);
      }
    },
    [setter, modifier]
  );
};

const IntervalModal: FC = () => {
  const interval = hooks.interval();
  const saveInterval = hooks.saveInterval();
  const deleteInterval = hooks.deleteInterval();

  const updateIntervalName = hooks.updateIntervalName();
  const handleIntervalNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateIntervalName(event.target.value);
    },
    [updateIntervalName]
  );

  const updateIntervalFrom = hooks.updateIntervalFrom();
  const handleFromChange = useNumericInput(updateIntervalFrom, 0.01);
  const updateIntervalTo = hooks.updateIntervalTo();
  const handleToChange = useNumericInput(updateIntervalTo, 0.01);
  const updateDuration = hooks.updateIntervalDuration();
  const handleMinsChange = useNumericInput(updateDuration, 60);
  const handleSecondsChange = useNumericInput(updateDuration);
  if (!interval) {
    return null;
  }

  return (
    <Overlay align="bottom">
      <Modal>
        <Input
          value={interval.name}
          onChange={handleIntervalNameChange}
          placeholder={capitalise(
            getZoneName(average(interval.from, interval.to))
          )}
        />
        <Box padding={2}>
          <Input
            placeholder="From"
            inputMode="numeric"
            value={(interval.from * 100).toFixed()}
            onChange={handleFromChange}
          />
          <Input
            placeholder="To"
            inputMode="numeric"
            value={(interval.to * 100).toFixed()}
            onChange={handleToChange}
          />
        </Box>
        <Box direction="row" padding={2} align="center">
          <Input
            placeholder="Min"
            inputMode="numeric"
            value={(interval.duration / 60).toFixed()}
            onChange={handleMinsChange}
          />
          <Text size={2}>:</Text>
          <Input
            placeholder="Sec"
            inputMode="numeric"
            value={(interval.duration % 60).toFixed()}
            onChange={handleSecondsChange}
          />
        </Box>
        <Box direction="row" justify="flex-end">
          <Button variant="danger" onClick={deleteInterval}>
            Delete
          </Button>
          <Button variant="success" onClick={saveInterval}>
            Done
          </Button>
        </Box>
      </Modal>
    </Overlay>
  );
};

const formatDuration = (duration: number) => {
  const minutes = duration % 60;
  const hours = Math.floor(duration / 60);
  return [hours, minutes].map((n) => `${n}`.padStart(2, "0")).join(":");
};

const WorkoutEditor: NextPage = () => {
  const { name } = hooks.workout();
  const createInterval = hooks.createInterval();
  const createSection = hooks.createSection();
  const board = hooks.board();
  const updateWorkoutName = hooks.updateWorkoutName();
  const section = hooks.section();
  const interval = hooks.interval();
  const stats = hooks.stats();
  const selectInterval = hooks.selectInterval();

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateWorkoutName(event.target.value);
    },
    [updateWorkoutName]
  );

  return (
    <Container>
      <Stats>
        <Input
          value={name}
          onChange={handleNameChange}
          placeholder="Name your workout..."
        />
        <Box direction="row">
          <Text size={1.2}>{formatDuration(stats.duration)}</Text>
          <Text size={1.2}>IF: {stats.intensity.toFixed(2)}</Text>
          <Text size={1.2}>TSS: {stats.trainingStress.toFixed(2)}</Text>
          <Text size={1.2} color={zoneToColor[getZoneName(stats.workingZone)]}>
            {capitalise(getZoneName(stats.workingZone))}
          </Text>
        </Box>
      </Stats>
      <BoardVisualizer
        board={board}
        minWidth={2}
        selectedIds={[section?.id, interval?.id]}
        onSelect={selectInterval}
      />
      <Toolbar>
        {!section && (
          <>
            <Button variant="primary" onClick={createSection}>
              + Section
            </Button>
            <Button variant="primary" onClick={createInterval}>
              + Interval
            </Button>
          </>
        )}
      </Toolbar>
      <SectionModal />
      <IntervalModal />
    </Container>
  );
};

export default WorkoutEditor;
