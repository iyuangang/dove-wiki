export function numberError(value: number, min: number, max = Infinity, integer = false) {
  if (!Number.isFinite(value)) return '请填写有效数字'
  if (integer && !Number.isInteger(value)) return '请填写整数'
  if (value < min || value > max) return Number.isFinite(max) ? `请输入 ${min}–${max} 之间的数字` : `请输入不小于 ${min} 的数字`
  return ''
}
