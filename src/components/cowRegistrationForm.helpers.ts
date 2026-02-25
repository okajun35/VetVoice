export interface FormState {
  cowId: string;
  earTagNo: string;
  sex: "FEMALE" | "MALE" | "CASTRATED" | "";
  breed: string;
  birthDate: string;
  parity: string;
  lastCalvingDate: string;
  name: string;
  farm: string;
}

export function buildInitialFormState(
  initialCowId: string,
  initialData?: Partial<FormState>,
): FormState {
  return {
    cowId: initialData?.cowId ?? initialCowId,
    earTagNo: initialData?.earTagNo ?? "",
    sex: initialData?.sex ?? "",
    breed: initialData?.breed ?? "",
    birthDate: initialData?.birthDate ?? "",
    parity:
      initialData?.parity !== undefined && initialData.parity !== null
        ? String(initialData.parity)
        : "",
    lastCalvingDate: initialData?.lastCalvingDate ?? "",
    name: initialData?.name ?? "",
    farm: initialData?.farm ?? "",
  };
}
