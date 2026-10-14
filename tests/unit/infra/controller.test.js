import controller from "infra/controller";
import {
  InternalServerError,
  MethodNotAllowedError,
  ValidationError,
  ConflictError,
} from "infra/errors";

afterEach(() => {
  jest.restoreAllMocks();
});

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Controller error handler", () => {
  test("Hiding internal details even when an unknown error has a status code", () => {
    const error = new Error("password=secret; SQL SELECT failed");
    error.statusCode = 400;
    const response = createResponse();
    const logger = jest.spyOn(console, "error").mockImplementation(() => {});

    controller.errorHandlers.onError(error, {}, response);

    expect(response.status).toHaveBeenCalledWith(500);
    const publicError = response.json.mock.calls[0][0];
    expect(publicError).toBeInstanceOf(InternalServerError);
    expect(publicError.cause).toBe(error);
    expect(JSON.parse(JSON.stringify(publicError))).toEqual({
      name: "InternalServerError",
      message: "Um erro interno não esperado aconteceu.",
      action: "Entre em contato com o suporte.",
      status_code: 500,
    });
    expect(logger).toHaveBeenCalledWith(publicError);
  });

  test.each([MethodNotAllowedError, ValidationError, ConflictError])(
    "Preserving %p without logging an internal failure",
    (ErrorClass) => {
      const error = new ErrorClass();
      const response = createResponse();
      const logger = jest.spyOn(console, "error").mockImplementation(() => {});

      controller.errorHandlers.onError(error, {}, response);

      expect(response.status).toHaveBeenCalledWith(error.statusCode);
      expect(response.json).toHaveBeenCalledWith(error);
      expect(logger).not.toHaveBeenCalled();
    },
  );
});
