from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from models.predictor import LifeLinkMLPredictor

app = FastAPI(
    title="LifeLink AI Demand & Wastage Microservice",
    description="Machine Learning Decision-Support API for Blood Demand Forecasting and Shortage Mitigation",
    version="1.0.0"
)

predictor = LifeLinkMLPredictor()

class DemandRequest(BaseModel):
    bloodGroup: str
    component: Optional[str] = "RBC"
    periodDays: Optional[int] = 7

class ShortageRequest(BaseModel):
    bloodGroup: str
    currentStock: int
    predictedDemand: int

class WastageRequest(BaseModel):
    unitId: str
    daysToExpiry: int
    component: Optional[str] = "RBC"

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "LifeLink ML Engine",
        "disclaimer": "LifeLink AI predictions provide statistical decision-support estimates and do not replace professional clinical decisions."
    }

@app.post("/predict/demand")
def predict_demand(req: DemandRequest):
    return predictor.forecast_demand(req.bloodGroup, req.component, req.periodDays)

@app.post("/predict/shortage")
def predict_shortage(req: ShortageRequest):
    return predictor.evaluate_shortage_risk(req.bloodGroup, req.currentStock, req.predictedDemand)

@app.post("/predict/wastage")
def predict_wastage(req: WastageRequest):
    return predictor.evaluate_wastage_risk(req.unitId, req.daysToExpiry, req.component)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
