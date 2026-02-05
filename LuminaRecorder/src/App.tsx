import { useState } from 'react';
import { WizardLayout } from './components/Wizard/WizardLayout';
import { VideoLoader } from './features/VideoLoader/VideoLoader';
import { WarpEditor } from './features/WarpEditor/WarpEditor';
import { Recorder } from './features/Recorder/Recorder';
import { SaveScreen } from './features/Save/SaveScreen';

type Step = 'load' | 'warp' | 'record' | 'save';

export interface WarpState {
  grid: { x: number; y: number }[][];
  rows: number;
  cols: number;
}

function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedFormat, setRecordedFormat] = useState<'webm' | 'mp4'>('webm');

  // Warp State
  const [warpState, setWarpState] = useState<WarpState>({
    grid: [], // Initial empty, will be set by Editor or default
    rows: 3,
    cols: 3
  });

  const steps: { key: Step; title: string; Component: React.ComponentType<any> }[] = [
    { key: 'load', title: 'Load Video', Component: VideoLoader },
    { key: 'warp', title: 'Adjust Distortion', Component: WarpEditor },
    { key: 'record', title: 'Record Output', Component: Recorder },
    { key: 'save', title: 'Save & Finish', Component: SaveScreen },
  ];

  const currentStepInfo = steps[stepIndex];

  const next = () => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  const back = () => setStepIndex((prev) => Math.max(prev - 1, 0));
  const reset = () => {
    setStepIndex(0);
    setVideoSource(null);
    setRecordedBlobUrl(null);
    setWarpState({ grid: [], rows: 3, cols: 3 });
  };

  const renderStep = () => {
    switch (currentStepInfo.key) {
      case 'load':
        return <VideoLoader onNext={next} setVideoSource={setVideoSource} videoSource={videoSource} />;
      case 'warp':
        return (
          <WarpEditor
            onNext={next}
            onBack={back}
            videoSource={videoSource}
            warpState={warpState}
            setWarpState={setWarpState}
          />
        );
      case 'record':
        return (
          <Recorder
            onNext={next}
            onBack={back}
            videoSource={videoSource}
            warpState={warpState}
            setRecordedBlobUrl={setRecordedBlobUrl}
            setRecordedFormat={(fmt) => setRecordedFormat(fmt)}
          />
        );
      case 'save':
        return <SaveScreen onReset={reset} recordedBlobUrl={recordedBlobUrl} format={recordedFormat} />;
      default:
        return null;
    }
  };

  return (
    <WizardLayout
      currentStep={stepIndex}
      totalSteps={steps.length}
      title={currentStepInfo.title}
    >
      {renderStep()}
    </WizardLayout>
  );
}

export default App;
