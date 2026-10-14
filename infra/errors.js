export class InternalServerError extends Error {
  constructor({ cause } = {}) {
    super("Um erro interno não esperado aconteceu.", {
      cause,
    });
    this.name = "InternalServerError";
    this.action = "Entre em contato com o suporte.";
    this.statusCode = 500;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class MethodNotAllowedError extends Error {
  constructor({ cause } = {}) {
    super("Método HTTP não permitido para este recurso.", { cause });
    this.name = "MethodNotAllowedError";
    this.action = "Utilize um dos métodos indicados no cabeçalho Allow.";
    this.statusCode = 405;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class ValidationError extends Error {
  constructor({ message = "Os dados informados são inválidos.", cause } = {}) {
    super(message, { cause });
    this.name = "ValidationError";
    this.action = "Corrija os dados informados e tente novamente.";
    this.statusCode = 400;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class ConflictError extends Error {
  constructor({ message = "O recurso informado já existe.", cause } = {}) {
    super(message, { cause });
    this.name = "ConflictError";
    this.action = "Informe dados que ainda não estejam cadastrados.";
    this.statusCode = 409;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}
