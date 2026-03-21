"""Post-processing validation for vision analysis results.

Runs sanity checks on the VisionAnalysisResult and flags potential issues.
"""

from dataclasses import dataclass, field

from app.models.vision import VisionAnalysisResult


@dataclass
class ValidationResult:
    is_valid: bool = True
    warnings: list[str] = field(default_factory=list)


def validate_analysis(result: VisionAnalysisResult) -> ValidationResult:
    """Run sanity checks on analysis results and return warnings."""
    warnings: list[str] = []

    # Rule 1: Total facings sanity (typical shelf is 15-50)
    if result.summary.total_facings > 60:
        warnings.append(
            f"Unusually high facing count ({result.summary.total_facings}). "
            "Possible depth counting."
        )

    if result.summary.total_facings < 5 and result.summary.total_facings > 0:
        warnings.append(
            f"Very low facing count ({result.summary.total_facings}). "
            "Possible missed detections."
        )

    # Rule 2: Single product with too many facings
    for p in result.products:
        if p.facings > 10 and not p.is_oos:
            warnings.append(
                f"Product '{p.product_name}' has {p.facings} facings — verify."
            )

    # Rule 3: Sum of facings must match declared total
    computed_total = sum(p.facings for p in result.products if not p.is_oos)
    if computed_total != result.summary.total_facings:
        warnings.append(
            f"Facing sum mismatch: products sum={computed_total}, "
            f"declared total={result.summary.total_facings}"
        )

    # Rule 4: Low average confidence
    if result.summary.avg_confidence < 0.65:
        warnings.append(
            "Low average confidence — results may be unreliable."
        )

    # Rule 5: No products detected (but not an empty shelf)
    if len(result.products) == 0:
        warnings.append("No products detected in image.")

    return ValidationResult(
        is_valid=len(warnings) == 0,
        warnings=warnings,
    )
