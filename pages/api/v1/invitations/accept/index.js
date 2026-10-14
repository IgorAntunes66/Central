import { createRouter } from "next-connect";
import controller from "infra/controller";
import invitation from "models/invitation";

const router = createRouter();

router.post(postHandler);

export default router.handler({
  onError: controller.errorHandlers.onError,
  onNoMatch(request, response) {
    response.setHeader("Allow", "POST");
    response.setHeader("Cache-Control", "no-store");
    return controller.errorHandlers.onNoMatch(request, response);
  },
});

async function postHandler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const user = await invitation.accept(request.body);
  return response.status(200).json(user);
}
