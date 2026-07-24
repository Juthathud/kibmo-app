import { useState } from "react";
import { patchProfile } from "../../api";
import IdCardScanStep from "./IdCardScanStep";
import PersonalInfoStep from "./PersonalInfoStep";
import ContactInfoStep from "./ContactInfoStep";
import AddressStep from "./AddressStep";
import MilitaryVehicleStep from "./MilitaryVehicleStep";
import AvailabilityStep from "./AvailabilityStep";
import CategoriesStep from "./CategoriesStep";
import WorkAreaStep from "./WorkAreaStep";
import ResumePromptStep from "./ResumePromptStep";
import DocumentsStep from "./DocumentsStep";

const STEPS = [
  IdCardScanStep,
  PersonalInfoStep,
  ContactInfoStep,
  AddressStep,
  MilitaryVehicleStep,
  AvailabilityStep,
  CategoriesStep,
  WorkAreaStep,
  ResumePromptStep,
  DocumentsStep,
];

export default function OnboardingWizard({ phone, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [prefill, setPrefill] = useState({});
  const Step = STEPS[stepIndex];
  const next = async () => {
    if (stepIndex >= STEPS.length - 1) {
      // A step's own "skip" button routes here too (see onSkip below), so
      // this is the only path guaranteed to run when the wizard ends —
      // persist onboarding_complete here rather than relying on each step
      // to do it, otherwise skipping the last step leaves the server
      // thinking onboarding never finished.
      try {
        await patchProfile(phone, { onboarding_complete: 1 });
      } catch {
        // best-effort — the worker still reaches Home this session even if
        // this write fails; profile screens let them retry later.
      }
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <Step
      phone={phone}
      onNext={next}
      onSkip={next}
      onComplete={onComplete}
      prefill={prefill}
      onExtracted={(fields) => setPrefill((p) => ({ ...p, ...fields }))}
    />
  );
}
