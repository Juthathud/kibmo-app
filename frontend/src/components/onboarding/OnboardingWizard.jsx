import { useState } from "react";
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
  const Step = STEPS[stepIndex];
  const next = () => {
    if (stepIndex >= STEPS.length - 1) {
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
    />
  );
}
