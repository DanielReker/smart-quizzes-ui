import {
    Box,
    Chip,
    Divider,
    FormControlLabel,
    Paper,
    Switch,
    TextField,
    Typography
} from '@mui/material';
import {formatHumanDuration, getTotalDurationSeconds} from '../utils/duration';

export interface QuizSettingsData {
    name: string;
    description: string;
    allowAnonymous: boolean;
    hasAttemptsLimit: boolean;
    maxAttempts: number;
    hasTimeLimit: boolean;
    timeHours: number;
    timeMinutes: number;
    timeSeconds: number;
}

interface QuizSettingsFieldsProps {
    values: QuizSettingsData;
    onChange: (updater: (prev: QuizSettingsData) => QuizSettingsData) => void;
    disabled?: boolean;
    showBasicFields?: boolean;
}

export const QuizSettingsFields = ({
    values,
    onChange,
    disabled = false,
    showBasicFields = true
}: QuizSettingsFieldsProps) => {
    const totalDurationSeconds = getTotalDurationSeconds(
        values.timeHours,
        values.timeMinutes,
        values.timeSeconds
    );

    return (
        <Box>
            {showBasicFields && (
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        label="Название"
                        value={values.name}
                        onChange={(e) =>
                            onChange((prev) => ({ ...prev, name: e.target.value }))
                        }
                        margin="normal"
                        required
                        disabled={disabled}
                    />
                    <TextField
                        fullWidth
                        label="Описание"
                        value={values.description}
                        onChange={(e) =>
                            onChange((prev) => ({ ...prev, description: e.target.value }))
                        }
                        margin="normal"
                        multiline
                        rows={3}
                        disabled={disabled}
                    />
                </Box>
            )}

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Параметры прохождения
                </Typography>

                <Box sx={{ mt: 1.5 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={values.allowAnonymous}
                                onChange={(e) =>
                                    onChange((prev) => ({
                                        ...prev,
                                        allowAnonymous: e.target.checked
                                    }))
                                }
                                disabled={disabled}
                            />
                        }
                        label="Разрешить анонимное прохождение"
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', ml: 4, mt: -0.5 }}
                    >
                        Пользователи смогут проходить тест без входа в аккаунт
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={values.hasAttemptsLimit}
                                onChange={(e) =>
                                    onChange((prev) => ({
                                        ...prev,
                                        hasAttemptsLimit: e.target.checked
                                    }))
                                }
                                disabled={disabled}
                            />
                        }
                        label="Ограничить количество попыток"
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', ml: 4, mt: -0.5 }}
                    >
                        Если выключено, количество попыток не ограничено
                    </Typography>

                    {values.hasAttemptsLimit && (
                        <Box sx={{ mt: 1.5, ml: 4 }}>
                            <TextField
                                label="Максимум попыток"
                                type="number"
                                size="small"
                                value={values.maxAttempts}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    onChange((prev) => ({
                                        ...prev,
                                        maxAttempts: isNaN(val) ? 1 : Math.max(1, val)
                                    }));
                                }}
                                slotProps={{
                                    htmlInput: { min: 1, step: 1 }
                                }}
                                helperText="Минимум 1 попытка"
                                disabled={disabled}
                                sx={{ width: 220 }}
                            />
                        </Box>
                    )}
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={values.hasTimeLimit}
                                onChange={(e) =>
                                    onChange((prev) => ({
                                        ...prev,
                                        hasTimeLimit: e.target.checked
                                    }))
                                }
                                disabled={disabled}
                            />
                        }
                        label="Ограничить время на прохождение"
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', ml: 4, mt: -0.5 }}
                    >
                        Если выключено, время на прохождение не ограничено
                    </Typography>

                    {values.hasTimeLimit && (
                        <Box sx={{ mt: 1.5, ml: 4 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }}
                            >
                                <TextField
                                    label="Часы"
                                    type="number"
                                    size="small"
                                    value={values.timeHours}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onChange((prev) => ({
                                            ...prev,
                                            timeHours: isNaN(val) ? 0 : Math.max(0, val)
                                        }));
                                    }}
                                    slotProps={{
                                        htmlInput: { min: 0, step: 1 }
                                    }}
                                    disabled={disabled}
                                    sx={{ width: 90 }}
                                />
                                <TextField
                                    label="Минуты"
                                    type="number"
                                    size="small"
                                    value={values.timeMinutes}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onChange((prev) => ({
                                            ...prev,
                                            timeMinutes: isNaN(val) ? 0 : Math.max(0, val)
                                        }));
                                    }}
                                    slotProps={{
                                        htmlInput: { min: 0, step: 1 }
                                    }}
                                    disabled={disabled}
                                    sx={{ width: 90 }}
                                />
                                <TextField
                                    label="Секунды"
                                    type="number"
                                    size="small"
                                    value={values.timeSeconds}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onChange((prev) => ({
                                            ...prev,
                                            timeSeconds: isNaN(val) ? 0 : Math.max(0, val)
                                        }));
                                    }}
                                    slotProps={{
                                        htmlInput: { min: 0, max: 59, step: 1 }
                                    }}
                                    disabled={disabled}
                                    sx={{ width: 90 }}
                                />
                                <Chip
                                    label={`Итого: ${formatHumanDuration(
                                        values.timeHours,
                                        values.timeMinutes,
                                        values.timeSeconds
                                    )}`}
                                    variant="outlined"
                                    color={totalDurationSeconds >= 1 ? 'primary' : 'error'}
                                    sx={{ fontWeight: 500 }}
                                />
                            </Box>
                            {totalDurationSeconds < 1 && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ display: 'block', mt: 0.5 }}
                                >
                                    Минимальное время на прохождение теста — 1 секунда
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    );
};
