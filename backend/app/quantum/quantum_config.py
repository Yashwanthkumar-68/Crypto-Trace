"""
Quantum Computing Configuration & Settings.
Supports dynamic switching between AerSimulator (local classical simulation)
and IBM Quantum Hardware (e.g. ibm_brisbane, ibm_kyiv, ibm_sherbrooke) via Qiskit 1.0+ and Qiskit Runtime.
"""

from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field
import os
import math

class QuantumBackendType(str, Enum):
    AER_SIMULATOR = "aer_simulator"
    STATEVECTOR = "statevector_simulator"
    IBM_BRISBANE = "ibm_brisbane"
    IBM_KYIV = "ibm_kyiv"
    IBM_SHERBROOKE = "ibm_sherbrooke"
    IBM_OSAKA = "ibm_osaka"
    MOCK_SIMULATOR = "mock_simulator"

class NoiseMitigationStrategy(str, Enum):
    NONE = "None"
    ZNE = "ZNE"  # Zero-Noise Extrapolation
    PEC = "PEC"  # Probabilistic Error Cancellation

class QuantumConfig(BaseModel):
    quantum_backend: QuantumBackendType = Field(
        default=QuantumBackendType.AER_SIMULATOR,
        description="Target backend for quantum circuit execution"
    )
    ibm_quantum_token: Optional[str] = Field(
        default_factory=lambda: os.getenv("IBM_QUANTUM_TOKEN", None),
        description="IBM Quantum API Token for hardware access"
    )
    ibm_instance: Optional[str] = Field(
        default_factory=lambda: os.getenv("IBM_QUANTUM_INSTANCE", "ibm-q/open/main"),
        description="IBM Quantum Hub/Group/Project instance"
    )
    shot_count: int = Field(
        default=1024,
        ge=1,
        le=100000,
        description="Number of circuit repetitions (shots)"
    )
    qaoa_depth: int = Field(
        default=3,
        ge=1,
        le=6,
        description="QAOA layer depth (p) between 3 and 6 layers"
    )
    quantum_threshold_nodes: int = Field(
        default=500,
        ge=1,
        description="Threshold node count above which quantum acceleration is triggered"
    )
    noise_mitigation: Optional[NoiseMitigationStrategy] = Field(
        default=NoiseMitigationStrategy.ZNE,
        description="Quantum error mitigation strategy (ZNE or PEC)"
    )
    optimization_level: int = Field(
        default=3,
        ge=0,
        le=3,
        description="Transpiler optimization level (0-3)"
    )
    resilience_level: int = Field(
        default=1,
        ge=0,
        le=2,
        description="Qiskit Runtime resilience level (1 for ZNE, 2 for PEC)"
    )

    @staticmethod
    def calculate_grover_iterations(num_items: int, num_targets: int = 1) -> int:
        """
        Calculates optimal Grover search iterations: k = round(pi / 4 * sqrt(N / M))
        """
        if num_items <= 0 or num_targets <= 0 or num_targets > num_items:
            return 1
        val = (math.pi / 4.0) * math.sqrt(float(num_items) / float(num_targets))
        return max(1, int(round(val)))

default_quantum_config = QuantumConfig()
