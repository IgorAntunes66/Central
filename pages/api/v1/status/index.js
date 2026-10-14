import { createRouter } from "next-connect";
import controller from "infra/controller";
import statusModel from "models/status";

const router = createRouter();

router.get(getHandler);

export default router.handler({
  onError: controller.errorHandlers.onError,
  onNoMatch(request, response) {
    response.setHeader("Allow", "GET, HEAD");
    return controller.errorHandlers.onNoMatch(request, response);
  },
});

async function getHandler(request, response) {
  const result = await statusModel.getStatus();
  if (
    !result.dependencies.email.connected ||
    (result.dependencies.mailcatcher &&
      !result.dependencies.mailcatcher.connected)
  ) {
    return response.status(503).json(result);
  }
  return response.status(200).json(result);
}
