import type { TargetingOperator } from '@flagforge/shared';
import {
  OPERATOR_LABELS,
  forcedValueType,
  isListOperator,
  parseDraft,
  type RuleDraft,
  type ValueType,
} from '../lib/rules';

interface RuleBuilderProps {
  drafts: RuleDraft[];
  onChange: (drafts: RuleDraft[]) => void;
}

const OPERATORS = Object.keys(OPERATOR_LABELS) as TargetingOperator[];

/** FR-23: ordered targeting rules; the first match wins (FR-21). */
export function RuleBuilder({ drafts, onChange }: RuleBuilderProps) {
  const update = (index: number, patch: Partial<RuleDraft>) =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const remove = (index: number) => onChange(drafts.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const next = [...drafts];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
  };

  if (drafts.length === 0) {
    return (
      <p className="muted">
        No rules. Everyone is decided by the rollout percentage. Add a rule to always serve a value
        to users with a matching attribute.
      </p>
    );
  }

  return (
    <ol className="rules">
      {drafts.map((draft, index) => {
        const parsed = parseDraft(draft);
        const forced = forcedValueType(draft.operator);
        return (
          <li key={index} className="rule">
            <div className="rule-order" aria-hidden>
              {index === 0 ? 'If' : 'Else if'}
            </div>
            <div className="rule-fields">
              <input
                className="input mono"
                aria-label={`Rule ${index + 1} attribute`}
                placeholder="attribute"
                value={draft.attribute}
                onChange={(e) => update(index, { attribute: e.target.value })}
              />
              <select
                className="input"
                aria-label={`Rule ${index + 1} operator`}
                value={draft.operator}
                onChange={(e) => update(index, { operator: e.target.value as TargetingOperator })}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              <input
                className="input mono"
                aria-label={`Rule ${index + 1} values`}
                placeholder={isListOperator(draft.operator) ? 'UA, PL, DE' : 'value'}
                value={draft.valuesText}
                onChange={(e) => update(index, { valuesText: e.target.value })}
              />
              <select
                className="input"
                aria-label={`Rule ${index + 1} value type`}
                value={forced ?? draft.valueType}
                disabled={forced !== null}
                onChange={(e) => update(index, { valueType: e.target.value as ValueType })}
              >
                <option value="string">text</option>
                <option value="number">number</option>
                <option value="boolean">true/false</option>
              </select>
              <span className="rule-then">serve</span>
              <select
                className="input"
                aria-label={`Rule ${index + 1} result`}
                value={String(draft.value)}
                onChange={(e) => update(index, { value: e.target.value === 'true' })}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </div>
            <div className="rule-actions">
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move rule ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Move rule ${index + 1} down`}
                disabled={index === drafts.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`Remove rule ${index + 1}`}
                onClick={() => remove(index)}
              >
                ✕
              </button>
            </div>
            {!parsed.ok && draft.attribute + draft.valuesText !== '' && (
              <p className="field-error">{parsed.error}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
