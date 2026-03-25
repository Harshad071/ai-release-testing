import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import requirementsRouter from "./requirements.js";
import analysesRouter from "./analyses.js";
import testCasesRouter from "./test-cases.js";
import webhooksRouter from "./webhooks.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/requirements", requirementsRouter);
router.use("/analyses", analysesRouter);
router.use("/test-cases", testCasesRouter);
router.use("/webhooks", webhooksRouter);

export default router;
