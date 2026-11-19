import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    FormGroup,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import type {AnswerResponseObjectVariant} from '../../api/generated/model';

export interface AnswerValueState {
    selectedChoiceId?: string | null;
    selectedChoiceIds?: string[];
    value?: string;
}

interface SubmissionAnswerCardProps {
    answer: AnswerResponseObjectVariant;
    questionIndex: number;
    value: AnswerValueState;
    onChange: (newValue: AnswerValueState) => void;
    isBlocked: boolean;
    submissionStatus?: string;
    onRevealHint: (answerId: string, penalty: number, remainingCount: number) => void;
    isRevealingHint: boolean;
}

export const SubmissionAnswerCard = ({
    answer,
    questionIndex,
    value,
    onChange,
    isBlocked,
    submissionStatus,
    onRevealHint,
    isRevealingHint,
}: SubmissionAnswerCardProps) => {
    const isAnswerScored =
        answer.status === 'SCORED' ||
        (submissionStatus === 'FINISHED' && answer.score !== null && answer.score !== undefined);

    const isEvaluating =
        submissionStatus !== 'IN_PROCESS' &&
        submissionStatus !== undefined &&
        !isAnswerScored;

    const remainingHintsCount = answer.nextHintsPenalties?.length || 0;
    const nextHintPenalty = remainingHintsCount > 0 ? answer.nextHintsPenalties[0] : 0;

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div">
                        {questionIndex + 1}. {answer.questionName}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center">
                        {isAnswerScored && (
                            <Chip
                                label={`Балл: ${answer.score ?? 0}`}
                                color={(answer.score ?? 0) > 0 ? 'success' : 'default'}
                                size="small"
                                variant="filled"
                            />
                        )}
                        {isEvaluating && (
                            <Chip
                                label="Оценивается..."
                                color="warning"
                                size="small"
                                icon={<CircularProgress size={12} color="inherit" />}
                            />
                        )}
                        {answer.status === 'UNANSWERED' && isAnswerScored && (
                            <Chip label="Без ответа" size="small" variant="outlined" />
                        )}
                    </Stack>
                </Box>

                {answer.questionDescription && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                        {answer.questionDescription}
                    </Typography>
                )}

                {answer.revealedHints && answer.revealedHints.length > 0 && (
                    <Box sx={{ my: 2 }}>
                        <Stack spacing={1}>
                            {answer.revealedHints.map((hint, idx) => (
                                <Paper
                                    key={hint.id || idx}
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        bgcolor: 'background.paper',
                                        borderLeft: 4,
                                        borderLeftColor: 'warning.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <LightbulbIcon color="warning" fontSize="small" />
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" fontWeight={500}>
                                            Подсказка {idx + 1}: {hint.text}
                                        </Typography>
                                    </Box>
                                    {hint.scorePenalty > 0 && (
                                        <Chip
                                            label={`Штраф: -${hint.scorePenalty} б.`}
                                            size="small"
                                            color="warning"
                                            variant="outlined"
                                        />
                                    )}
                                </Paper>
                            ))}
                        </Stack>
                    </Box>
                )}

                {remainingHintsCount > 0 && !isBlocked && (
                    <Box sx={{ my: 1.5 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<LightbulbOutlinedIcon />}
                            disabled={isRevealingHint}
                            onClick={() => onRevealHint(answer.id, nextHintPenalty, remainingHintsCount)}
                        >
                            Открыть подсказку (штраф: -{nextHintPenalty} б., осталось: {remainingHintsCount})
                        </Button>
                    </Box>
                )}

                {answer.dtype === 'single-choice' && (
                    <RadioGroup
                        value={value.selectedChoiceId ?? ''}
                        onChange={(e) => {
                            if (!isBlocked) {
                                onChange({ ...value, selectedChoiceId: e.target.value });
                            }
                        }}
                    >
                        {answer.possibleChoices
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((choice) => {
                                const choiceId = choice.id ?? '';
                                const isSelected = value.selectedChoiceId === choiceId;
                                const isCorrectChoice = choice.isCorrect === true;

                                let choiceBgColor = 'transparent';
                                let choiceBorderColor = 'divider';
                                let statusIcon = null;
                                let statusLabel = null;

                                if (isAnswerScored) {
                                    if (isCorrectChoice) {
                                        choiceBgColor = 'rgba(46, 125, 50, 0.08)';
                                        choiceBorderColor = 'success.main';
                                        statusIcon = <CheckCircleIcon color="success" fontSize="small" sx={{ mr: 1 }} />;
                                        statusLabel = (
                                            <Chip
                                                label={isSelected ? 'Ваш ответ (верно)' : 'Правильный ответ'}
                                                size="small"
                                                color="success"
                                                sx={{ ml: 1 }}
                                            />
                                        );
                                    } else if (isSelected) {
                                        choiceBgColor = 'rgba(211, 47, 47, 0.08)';
                                        choiceBorderColor = 'error.main';
                                        statusIcon = <CancelIcon color="error" fontSize="small" sx={{ mr: 1 }} />;
                                        statusLabel = (
                                            <Chip
                                                label="Ваш ответ (неверно)"
                                                size="small"
                                                color="error"
                                                sx={{ ml: 1 }}
                                            />
                                        );
                                    }
                                }

                                return (
                                    <Paper
                                        key={choiceId}
                                        variant="outlined"
                                        sx={{
                                            mb: 1,
                                            px: 1.5,
                                            py: 0.5,
                                            bgcolor: choiceBgColor,
                                            borderColor: choiceBorderColor,
                                            borderWidth: isAnswerScored && (isCorrectChoice || isSelected) ? 2 : 1,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <FormControlLabel
                                            value={choiceId}
                                            control={<Radio disabled={isBlocked} />}
                                            label={choice.name}
                                            sx={{ flexGrow: 1, mr: 0 }}
                                        />
                                        {statusIcon}
                                        {statusLabel}
                                    </Paper>
                                );
                            })}
                    </RadioGroup>
                )}

                {answer.dtype === 'multi-choice' && (
                    <FormGroup>
                        {answer.possibleChoices
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((choice) => {
                                const choiceId = choice.id ?? '';
                                const selectedList = value.selectedChoiceIds || [];
                                const isChecked = selectedList.includes(choiceId);
                                const isCorrectChoice = choice.isCorrect === true;

                                let choiceBgColor = 'transparent';
                                let choiceBorderColor = 'divider';
                                let statusIcon = null;
                                let statusLabel = null;

                                if (isAnswerScored) {
                                    if (isCorrectChoice) {
                                        choiceBgColor = 'rgba(46, 125, 50, 0.08)';
                                        choiceBorderColor = 'success.main';
                                        statusIcon = <CheckCircleIcon color="success" fontSize="small" sx={{ mr: 1 }} />;
                                        statusLabel = (
                                            <Chip
                                                label={isChecked ? 'Ваш выбор (верно)' : 'Правильный вариант'}
                                                size="small"
                                                color="success"
                                                sx={{ ml: 1 }}
                                            />
                                        );
                                    } else if (isChecked) {
                                        choiceBgColor = 'rgba(211, 47, 47, 0.08)';
                                        choiceBorderColor = 'error.main';
                                        statusIcon = <CancelIcon color="error" fontSize="small" sx={{ mr: 1 }} />;
                                        statusLabel = (
                                            <Chip
                                                label="Ваш выбор (неверно)"
                                                size="small"
                                                color="error"
                                                sx={{ ml: 1 }}
                                            />
                                        );
                                    }
                                }

                                const handleToggle = () => {
                                    if (isBlocked) return;
                                    const nextList = isChecked
                                        ? selectedList.filter((id) => id !== choiceId)
                                        : [...selectedList, choiceId];
                                    onChange({ ...value, selectedChoiceIds: nextList });
                                };

                                return (
                                    <Paper
                                        key={choiceId}
                                        variant="outlined"
                                        sx={{
                                            mb: 1,
                                            px: 1.5,
                                            py: 0.5,
                                            bgcolor: choiceBgColor,
                                            borderColor: choiceBorderColor,
                                            borderWidth: isAnswerScored && (isCorrectChoice || isChecked) ? 2 : 1,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isChecked}
                                                    onChange={handleToggle}
                                                    disabled={isBlocked}
                                                />
                                            }
                                            label={choice.name}
                                            sx={{ flexGrow: 1, mr: 0 }}
                                        />
                                        {statusIcon}
                                        {statusLabel}
                                    </Paper>
                                );
                            })}
                    </FormGroup>
                )}

                {answer.dtype === 'text' && (
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            multiline
                            rows={3}
                            fullWidth
                            label="Ваш ответ"
                            value={value.value ?? ''}
                            disabled={isBlocked}
                            onChange={(e) => {
                                if (!isBlocked) {
                                    onChange({ ...value, value: e.target.value });
                                }
                            }}
                        />

                        {isAnswerScored && answer.sampleCorrectAnswer && (
                            <Paper
                                variant="outlined"
                                sx={{
                                    mt: 2,
                                    p: 1.5,
                                    bgcolor: 'rgba(46, 125, 50, 0.05)',
                                    borderColor: 'success.light'
                                }}
                            >
                                <Typography variant="caption" color="success.dark" fontWeight={600} display="block">
                                    Образец правильного ответа:
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                                    {answer.sampleCorrectAnswer}
                                </Typography>
                            </Paper>
                        )}

                        {isAnswerScored && answer.feedback && (
                            <Paper
                                variant="outlined"
                                sx={{
                                    mt: 1.5,
                                    p: 1.5,
                                    bgcolor: 'rgba(2, 136, 209, 0.05)',
                                    borderColor: 'info.light'
                                }}
                            >
                                <Typography variant="caption" color="info.dark" fontWeight={600} display="block">
                                    Отзыв проверяющего:
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                                    {answer.feedback}
                                </Typography>
                            </Paper>
                        )}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};
