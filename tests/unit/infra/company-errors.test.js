import { ValidationError, ConflictError } from "infra/errors";

describe("Company errors", () => {
  test.each([
    [ValidationError, 400],
    [ConflictError, 409],
  ])("Serializes %p without exposing the cause", (ErrorClass, statusCode) => {
    const cause = new Error("Private database details");
    const error = new ErrorClass({ message: "Mensagem pública.", cause });

    expect(error.cause).toBe(cause);
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: ErrorClass.name,
      message: "Mensagem pública.",
      action: error.action,
      status_code: statusCode,
    });
  });
});
