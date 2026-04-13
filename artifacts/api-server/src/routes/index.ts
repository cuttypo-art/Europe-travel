import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/pdf", pdfRouter);

export default router;
