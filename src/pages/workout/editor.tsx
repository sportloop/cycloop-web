import { useCallback, ChangeEvent, FC } from "react";
import { NextPage } from "next";
import { styled } from "linaria/react";

import { hooks, Section } from "../../modules/workoutEditor";
import WorkoutVisualizer, {
  BoardVisualizer,
} from "../../components/WorkoutVisualizer";
import Modal from "../../components/Modal";
import Overlay from "../../components/Overlay";
import Box from "../../components/Box";
import { getZoneName, average, capitalise, zoneToColor } from "../../utils";
import useCapture from "../../hooks/useCapture";

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
`;

const Input = styled.input`
  padding: 1rem;
  font-size: 2.2rem;
  background: none;
  border: none;
  color: white;
  :focus {
    outline: none;
    color: yellow;
  }
  text-align: ${({ center }: { center?: boolean }) =>
    center ? "center" : "initial"};
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

const SectionBox = styled(Box)`
  border-radius: 1rem;
  margin-right: 1rem;
  overflow: hidden;
  position: relative;
`;

const AddSection = styled.button`
  border: 1px solid white;
  color: white;
  background: transparent;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  appearance: none;
  font-size: 2rem;
  width: 15rem;
  height: 20rem;
`;

const SectionName = styled.h3`
  color: black;
  text-align: center;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  font-size: 1.6rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1rem;
`;

const SectionAction: FC<Section> = ({ name, id, intervals }) => {
  return (
    <SectionBox width={15} height={20} align="center">
      <Box direction="row" height="100%" align="stretch">
        <WorkoutVisualizer intervals={intervals} />
      </Box>
      <SectionName>{name}</SectionName>
    </SectionBox>
  );
};

const SectionsList = styled(Box)`
  padding: 2rem 0;
  overflow-x: auto;
`;

const SectionsModal: FC = () => {
  const sections = hooks.sections();
  const show = hooks.sectionsOpen();
  const close = useCapture(hooks.closeSections(), { targetCheck: true });
  const add = hooks.addSection();

  if (!show) {
    return null;
  }

  return (
    <Overlay align="bottom" onClick={close}>
      <Modal>
        <SectionsList>
          <Box width="auto" direction="row">
            {sections
              .map((section) => {
                return (
                  <SectionAction
                    key={section.id}
                    name={section.name}
                    id={section.id}
                    intervals={section.intervals}
                    modifier={section.modifier}
                  />
                );
              })
              .concat([
                <AddSection key="new" onClick={add}>
                  + New
                </AddSection>,
              ])}
          </Box>
        </SectionsList>
      </Modal>
    </Overlay>
  );
};

const SectionEditorModal: FC = () => {
  const section = hooks.section();
  const show = hooks.sectionEditorOpen();
  const createInterval = hooks.createInterval();
  const addSection = hooks.addSection();
  const updateSectionName = hooks.updateSectionName();
  const cancelSection = hooks.cancelSection();
  const selectInterval = hooks.selectInterval();
  const interval = hooks.interval();
  const handleSectionNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSectionName(event.target.value);
    },
    [updateSectionName]
  );

  if (!show) {
    return null;
  }

  return (
    <Overlay align="bottom">
      <Modal>
        <Input
          value={section.name}
          onChange={handleSectionNameChange}
          placeholder="Name this section..."
          center
        />
        <Box direction="row" height={40} padding="2rem 0" align="intial">
          <WorkoutVisualizer
            intervals={section.intervals}
            onSelect={selectInterval}
            selected={interval?.id}
          />
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

const DurationInput: FC<{
  onChange: (d: number) => void;
  value: number;
}> = ({ onChange, value }) => {
  const handleChange = useCallback(
    (event) => {
      const { minutes, seconds } = Object.fromEntries(
        new FormData(event.currentTarget)
      );
      const mins = parseInt(minutes as string, 10);
      const secs = parseInt(seconds as string, 10);
      // eslint-disable-next-line no-nested-ternary
      const time =
        (Number.isNaN(mins) ? 0 : mins) * 60 + (Number.isNaN(secs) ? 0 : secs);
      onChange(time);
    },
    [onChange]
  );
  return (
    <Box direction="row" padding={2} align="center">
      <form onChange={handleChange}>
        <Input
          placeholder="Min"
          inputMode="numeric"
          name="minutes"
          value={Math.floor(value / 60)}
        />
        <Text size={2}>:</Text>
        <Input
          placeholder="Sec"
          inputMode="numeric"
          name="seconds"
          value={(value % 60).toFixed()}
        />
      </form>
    </Box>
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
        <DurationInput value={interval.duration} onChange={updateDuration} />
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
  const openSections = hooks.openSections();
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
            <Button variant="primary" onClick={openSections}>
              Sections
            </Button>
            <Button variant="primary" onClick={createInterval}>
              + Interval
            </Button>
          </>
        )}
      </Toolbar>
      <SectionEditorModal />
      <IntervalModal />
      <SectionsModal />
    </Container>
  );
};

export default WorkoutEditor;
