import {useState} from 'react';
import {useFieldArray, useForm} from 'react-hook-form';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    InputAdornment,
    Snackbar,
    TextField,
    Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayCircle from '@mui/icons-material/PlayCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import StopCircle from '@mui/icons-material/StopCircle';
import {useNavigate, useParams} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';

import {
    getGetQuizQueryKey,
    useAiGenerateQuestions,
    useFinishQuiz,
    useGetQuiz,
    useStartQuiz,
    useUpdateQuiz,
    useUpsertQuestions
} from '../api/generated';
import {
    type MultiChoiceQuestionDto,
    type QuizQuestionsUpsertRequest,
    type QuizResponse,
    QuizResponseStatus,
    type QuizUpdateRequest,
    type QuestionDtoVariant,
    type SingleChoiceQuestionDto,
    type TextQuestionDto
} from '../api/generated/model';
import {QuestionCard} from '../components/questions/QuestionCard.tsx';
import QuizStatus from '../components/QuizStatus.tsx';
import {QuizNavigation} from '../components/QuizNavigation.tsx';
import {QuizSettingsFields, type QuizSettingsData} from '../components/QuizSettingsFields.tsx';
import {
    formatHumanDuration,
    formatIsoDuration,
    getTotalDurationSeconds,
    parseIsoDuration
} from '../utils/duration';

function prepareChoiceQuestionForSave(
    question: SingleChoiceQuestionDto | MultiChoiceQuestionDto,
    index: number
): SingleChoiceQuestionDto | MultiChoiceQuestionDto {
    return {
        ...question,
        id: null,
        position: index,
        maxScore: Number(question.maxScore) || 0,
        hints: (question.hints || []).map((hint, hintIndex: number) => ({
            id: null,
            sequentialOrder: hintIndex,
            scorePenalty: Number(hint.scorePenalty) || 0,
            text: hint.text.trim()
        })),
        possibleChoices: (question.possibleChoices || []).map((choice, choiceIndex: number) => ({
            id: null,
            position: choiceIndex,
            name: choice.name.trim(),
            isCorrect: Boolean(choice.isCorrect)
        }))
    };
}

function prepareTextQuestionForSave(
    question: TextQuestionDto,
    index: number
): TextQuestionDto {
    return {
        ...question,
        id: null,
        position: index,
        maxScore: Number(question.maxScore) || 0,
        maxLength: question.maxLength ? Number(question.maxLength) : null,
        sampleCorrectAnswer: question.sampleCorrectAnswer?.trim() || null,
        hints: (question.hints || []).map((hint, hintIndex: number) => ({
            id: null,
            sequentialOrder: hintIndex,
            scorePenalty: Number(hint.scorePenalty) || 0,
            text: hint.text.trim()
        }))
    };
}

const prepareQuestionsForSave = (formData: QuizQuestionsUpsertRequest): QuestionDtoVariant[] => {
    return formData.questions.map((question, index) => {
        if (question.dtype === 'text') {
            return prepareTextQuestionForSave(question, index);
        } else if (question.dtype === 'single-choice' || question.dtype === 'multi-choice') {
            return prepareChoiceQuestionForSave(question, index);
        } else {
            throw new Error('Unexpected question type');
        }
    });
};

const prepareQuestionsForForm = (questions: QuestionDtoVariant[]): QuestionDtoVariant[] => {
    const sortedQuestions = [...questions].sort((a, b) => a.position - b.position);
    return sortedQuestions.map((q) => {
        const sortedHints = q.hints ? [...q.hints].sort((a, b) => a.sequentialOrder - b.sequentialOrder) : [];
        if ('possibleChoices' in q && q.possibleChoices) {
            return {
                ...q,
                maxScore: q.maxScore ?? 1,
                hints: sortedHints,
                possibleChoices: [...q.possibleChoices]
                    .sort((a, b) => a.position - b.position)
                    .map((choice) => ({
                        ...choice,
                        isCorrect: Boolean(choice.isCorrect)
                    }))
            };
        }
        return {
            ...q,
            maxScore: q.maxScore ?? 1,
            hints: sortedHints
        };
    });
};

function validateQuizQuestions(questions: QuestionDtoVariant[]): string | null {
    if (!questions || questions.length === 0) {
        return 'Добавьте хотя бы один вопрос в тест';
    }

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = i + 1;

        if (!q.name || !q.name.trim()) {
            return `Вопрос №${qNum}: заполните текст вопроса`;
        }

        const maxScore = Number(q.maxScore);
        if (isNaN(maxScore) || maxScore < 0) {
            return `Вопрос №${qNum}: максимальный балл вопроса не может быть отрицательным`;
        }

        const hints = q.hints || [];
        let totalPenalty = 0;
        for (let hIdx = 0; hIdx < hints.length; hIdx++) {
            const hint = hints[hIdx];
            const hNum = hIdx + 1;
            if (!hint.text || !hint.text.trim()) {
                return `Вопрос №${qNum}, подсказка №${hNum}: заполните текст подсказки`;
            }
            const penalty = Number(hint.scorePenalty);
            if (isNaN(penalty) || penalty < 0) {
                return `Вопрос №${qNum}, подсказка №${hNum}: штраф не может быть отрицательным`;
            }
            totalPenalty += penalty;
        }

        const minPossibleScore = Math.round((maxScore - totalPenalty) * 100) / 100;
        if (minPossibleScore < 0) {
            return `Вопрос №${qNum}: минимальный балл вопроса не может быть отрицательным. Сумма штрафов (${totalPenalty}) превышает максимальный балл (${maxScore})`;
        }

        if (q.dtype === 'single-choice' || q.dtype === 'multi-choice') {
            const choices = q.possibleChoices || [];
            if (choices.length === 0) {
                return `Вопрос №${qNum}: добавьте варианты ответов`;
            }
            for (let cIdx = 0; cIdx < choices.length; cIdx++) {
                if (!choices[cIdx].name || !choices[cIdx].name.trim()) {
                    return `Вопрос №${qNum}: заполните текст всех вариантов ответа`;
                }
            }
            const correctCount = choices.filter((c) => c.isCorrect).length;

            if (q.dtype === 'single-choice' && correctCount !== 1) {
                return `Вопрос №${qNum}: вопрос с одиночным выбором должен содержать ровно один правильный вариант ответа`;
            }
        }
    }

    return null;
}

function validateSettings(data: QuizSettingsData): string | null {
    if (!data.name.trim()) {
        return 'Укажите название теста';
    }
    if (data.hasAttemptsLimit && (!data.maxAttempts || data.maxAttempts < 1)) {
        return 'Количество попыток должно быть не меньше 1';
    }
    if (
        data.hasTimeLimit &&
        getTotalDurationSeconds(data.timeHours, data.timeMinutes, data.timeSeconds) < 1
    ) {
        return 'Время на прохождение должно быть не менее 1 секунды';
    }
    return null;
}

function getQuizUpdatePayload(data: QuizSettingsData): QuizUpdateRequest {
    return {
        name: data.name.trim(),
        description: data.description.trim() ? data.description.trim() : null,
        allowAnonymous: data.allowAnonymous,
        maxAttempts: data.hasAttemptsLimit
            ? Math.max(1, Math.floor(Number(data.maxAttempts)))
            : null,
        timeToComplete: data.hasTimeLimit
            ? formatIsoDuration(data.timeHours, data.timeMinutes, data.timeSeconds)
            : null,
    };
}

function initSettings(quiz: QuizResponse): QuizSettingsData {
    const duration = parseIsoDuration(quiz.timeToComplete);
    return {
        name: quiz.name ?? '',
        description: quiz.description ?? '',
        allowAnonymous: Boolean(quiz.allowAnonymous),
        hasAttemptsLimit: quiz.maxAttempts !== null && quiz.maxAttempts !== undefined,
        maxAttempts: quiz.maxAttempts ?? 1,
        hasTimeLimit: Boolean(quiz.timeToComplete),
        timeHours: duration.hours,
        timeMinutes: duration.minutes,
        timeSeconds: duration.seconds,
    };
}

const EditQuizContent = ({id, initialQuiz}: {id: string; initialQuiz: QuizResponse}) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState<QuizResponse>(initialQuiz);
    const [aiPrompt, setAiPrompt] = useState('');
    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const [settings, setSettings] = useState<QuizSettingsData>(() => initSettings(initialQuiz));

    const {mutateAsync: updateQuiz, isPending: isUpdatingQuiz} = useUpdateQuiz();
    const {mutateAsync: saveQuestions, isPending: isSaving} = useUpsertQuestions();
    const {mutateAsync: generateAiQuestions, isPending: isGenerating} = useAiGenerateQuestions();

    const {mutateAsync: startQuiz, isPending: isStarting} = useStartQuiz({
        mutation: {
            onSuccess: (updatedQuizData) => {
                queryClient.setQueryData(getGetQuizQueryKey(id), updatedQuizData);
                setQuiz(updatedQuizData);
                navigate(`/quizzes/${id}/stats`);
            },
            onError: () => {
                setNotification({
                    open: true,
                    message: 'Не удалось запустить тест',
                    severity: 'error'
                });
            }
        }
    });

    const {mutateAsync: finishQuiz, isPending: isFinishing} = useFinishQuiz({
        mutation: {
            onSuccess: (updatedQuizData) => {
                queryClient.setQueryData(getGetQuizQueryKey(id), updatedQuizData);
                setQuiz(updatedQuizData);
            }
        }
    });

    const {control, handleSubmit, reset, setValue} = useForm<QuizQuestionsUpsertRequest>({
        defaultValues: {questions: prepareQuestionsForForm(initialQuiz.questions || [])}
    });

    const {fields, append, remove, move} = useFieldArray({
        control,
        name: 'questions',
        keyName: 'fieldId'
    });

    const handleSaveSettingsOnly = async () => {
        const error = validateSettings(settings);
        if (error) {
            setNotification({
                open: true,
                message: error,
                severity: 'error'
            });
            return;
        }

        try {
            const updatedQuiz = await updateQuiz({
                quizId: id,
                data: getQuizUpdatePayload(settings)
            });
            queryClient.setQueryData(getGetQuizQueryKey(id), updatedQuiz);
            setQuiz(updatedQuiz);
            setSettings(initSettings(updatedQuiz));
            setNotification({
                open: true,
                message: 'Параметры теста успешно сохранены',
                severity: 'success'
            });
        } catch (e) {
            console.error(e);
            setNotification({
                open: true,
                message: 'Ошибка при сохранении параметров теста',
                severity: 'error'
            });
        }
    };

    const onManualSave = async (data: QuizQuestionsUpsertRequest) => {
        const questionsError = validateQuizQuestions(data.questions);
        if (questionsError) {
            setNotification({
                open: true,
                message: questionsError,
                severity: 'error'
            });
            return;
        }

        const settingsError = validateSettings(settings);
        if (settingsError) {
            setNotification({
                open: true,
                message: settingsError,
                severity: 'error'
            });
            return;
        }

        const questionsToSend = prepareQuestionsForSave(data);
        try {
            const [updatedQuiz] = await Promise.all([
                updateQuiz({
                    quizId: id,
                    data: getQuizUpdatePayload(settings)
                }),
                saveQuestions({
                    quizId: id,
                    data: {questions: questionsToSend}
                })
            ]);
            queryClient.setQueryData(getGetQuizQueryKey(id), updatedQuiz);
            setQuiz(updatedQuiz);
            setSettings(initSettings(updatedQuiz));
            setNotification({
                open: true,
                message: 'Все изменения успешно сохранены',
                severity: 'success'
            });
        } catch (e) {
            console.error(e);
            setNotification({
                open: true,
                message: 'Ошибка при сохранении изменений',
                severity: 'error'
            });
        }
    };

    const onAiGenerate = async (data: QuizQuestionsUpsertRequest) => {
        if (!aiPrompt.trim()) return;

        const questionsToSend = prepareQuestionsForSave(data);

        try {
            await saveQuestions({quizId: id, data: {questions: questionsToSend}});

            const updatedQuiz: QuizResponse = await generateAiQuestions({
                quizId: id,
                data: {prompt: aiPrompt}
            });

            if (updatedQuiz.questions) {
                queryClient.setQueryData(getGetQuizQueryKey(id), updatedQuiz);
                setQuiz(updatedQuiz);
                reset({questions: prepareQuestionsForForm(updatedQuiz.questions)});
                setAiPrompt('');
                setNotification({
                    open: true,
                    message: 'Вопросы успешно сгенерированы',
                    severity: 'success'
                });
            }
        } catch (e) {
            console.error(e);
            setNotification({
                open: true,
                message: 'Не удалось сгенерировать вопросы. Пожалуйста, попробуйте позже.',
                severity: 'error'
            });
        }
    };

    const isGlobalLoading = isSaving || isGenerating || isUpdatingQuiz;
    const isDraft = quiz.status === 'DRAFT';

    return (
        <Box maxWidth="md" mx="auto" pb={10}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>{quiz.name}</Typography>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <QuizStatus status={quiz.status || QuizResponseStatus.DRAFT} />
                    {isDraft && (
                        <Button
                            variant="contained"
                            color="success"
                            endIcon={<PlayCircle />}
                            disabled={isStarting}
                            onClick={() => startQuiz({quizId: id})}
                        >
                            {isStarting ? 'Запуск...' : 'Запустить тест'}
                        </Button>
                    )}
                    {quiz.status === 'ACTIVE' && (
                        <Button
                            variant="contained"
                            color="warning"
                            endIcon={<StopCircle />}
                            disabled={isFinishing}
                            onClick={() => finishQuiz({quizId: id})}
                        >
                            {isFinishing ? 'Завершение...' : 'Завершить тест'}
                        </Button>
                    )}
                </Box>

                <QuizNavigation quizId={id} status={quiz.status} />
            </Box>

            {isDraft ? (
                <>
                    <Accordion
                        variant="outlined"
                        sx={{
                            mb: 3,
                            borderRadius: '8px !important',
                            '&:before': {display: 'none'}
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    flexWrap: 'wrap',
                                    width: '100%',
                                    pr: 2
                                }}
                            >
                                <SettingsIcon color="action" />
                                <Typography variant="h6" sx={{mr: 'auto', fontSize: '1.05rem'}}>
                                    Параметры теста
                                </Typography>
                                <Chip
                                    size="small"
                                    label={settings.allowAnonymous ? 'Анонимно: да' : 'Анонимно: нет'}
                                    color={settings.allowAnonymous ? 'success' : 'default'}
                                    variant="outlined"
                                />
                                <Chip
                                    size="small"
                                    label={
                                        settings.hasAttemptsLimit
                                            ? `Попыток: ${settings.maxAttempts}`
                                            : 'Попытки: без ограничений'
                                    }
                                    variant="outlined"
                                />
                                <Chip
                                    size="small"
                                    label={
                                        settings.hasTimeLimit
                                            ? `Время: ${formatHumanDuration(
                                                  settings.timeHours,
                                                  settings.timeMinutes,
                                                  settings.timeSeconds
                                              )}`
                                            : 'Время: без ограничений'
                                    }
                                    variant="outlined"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{pt: 1, pb: 2.5, px: 3}}>
                            <QuizSettingsFields
                                values={settings}
                                onChange={setSettings}
                                disabled={isGlobalLoading}
                            />
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2.5}}>
                                <Button
                                    variant="contained"
                                    onClick={handleSaveSettingsOnly}
                                    disabled={isGlobalLoading}
                                >
                                    {isUpdatingQuiz ? (
                                        <CircularProgress size={24} color="inherit" />
                                    ) : (
                                        'Сохранить параметры'
                                    )}
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    <Card sx={{mb: 4, border: '1px dashed', borderColor: 'primary.main', bgcolor: '#f9faff'}}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <AutoAwesomeIcon color="primary" />
                                <Typography variant="h6" color="primary">ИИ-ассистент</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                                Введите тему или инструкции (например, "Добавь 3 вопроса про потоки в Java")
                                и ИИ обновит ваш тест. Вопросы будут сохранены автоматически.
                            </Typography>

                            <Box display="flex" gap={2} alignItems="flex-start">
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={6}
                                    placeholder="Пример: Сгенерируй тест на тему Java Stream API. Он должен содержать 5 вопросов, от простых к сложным. Используй вопросы разных типов"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    disabled={isGlobalLoading}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <AutoAwesomeIcon fontSize="small" color="disabled"/>
                                                </InputAdornment>
                                            ),
                                        }
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit(onAiGenerate)}
                                    disabled={isGlobalLoading || !aiPrompt.trim()}
                                    sx={{minWidth: 120, mt: 1}}
                                >
                                    {isGenerating ? <CircularProgress size={24} color="inherit"/> : 'Сгенерировать'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>

                    <Divider sx={{mb: 3}} />

                    <form onSubmit={handleSubmit(onManualSave)}>
                        {fields.map((field, index) => (
                            <QuestionCard
                                key={field.fieldId}
                                index={index}
                                field={field}
                                control={control}
                                setValue={setValue}
                                remove={remove}
                                move={move}
                                isFirst={index === 0}
                                isLast={index === fields.length - 1}
                            />
                        ))}

                        <Box sx={{display: 'flex', gap: 2, mt: 3, mb: 10, flexWrap: 'wrap'}}>
                            <Button
                                variant="outlined"
                                startIcon={<AddCircleOutlineIcon />}
                                disabled={isGlobalLoading}
                                onClick={() => append({
                                    dtype: 'text',
                                    name: '',
                                    isRequired: true,
                                    position: fields.length,
                                    maxScore: 1,
                                    hints: [],
                                    maxLength: 1000,
                                    sampleCorrectAnswer: ''
                                })}
                            >
                                Текст
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<AddCircleOutlineIcon />}
                                disabled={isGlobalLoading}
                                onClick={() => append({
                                    dtype: 'single-choice',
                                    name: '',
                                    isRequired: true,
                                    position: fields.length,
                                    maxScore: 1,
                                    hints: [],
                                    possibleChoices: []
                                })}
                            >
                                Одиночный выбор
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<AddCircleOutlineIcon />}
                                disabled={isGlobalLoading}
                                onClick={() => append({
                                    dtype: 'multi-choice',
                                    name: '',
                                    isRequired: true,
                                    position: fields.length,
                                    maxScore: 1,
                                    hints: [],
                                    possibleChoices: []
                                })}
                            >
                                Множественный выбор
                            </Button>
                        </Box>

                        <Box
                            sx={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                p: 2,
                                bgcolor: 'background.paper',
                                borderTop: '1px solid #ddd',
                                display: 'flex',
                                justifyContent: 'center',
                                zIndex: 1000,
                                boxShadow: '0px -2px 10px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={isGlobalLoading}
                                sx={{width: 300}}
                            >
                                {isSaving || isUpdatingQuiz ? 'Сохранение...' : 'Сохранить изменения'}
                            </Button>
                        </Box>
                    </form>
                </>
            ) : (
                <Card sx={{p: 4, textAlign: 'center'}}>
                    <Typography variant="h6" color="text.secondary">
                        Тест активен, редактирование недоступно
                    </Typography>
                    <Box sx={{display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap'}}>
                        <Chip
                            label={quiz.allowAnonymous ? 'Анонимный доступ: да' : 'Анонимный доступ: нет'}
                            color={quiz.allowAnonymous ? 'success' : 'default'}
                            variant="outlined"
                        />
                        <Chip
                            label={
                                quiz.maxAttempts !== null && quiz.maxAttempts !== undefined
                                    ? `Попыток: ${quiz.maxAttempts}`
                                    : 'Попытки: без ограничений'
                            }
                            variant="outlined"
                        />
                        <Chip
                            label={
                                quiz.timeToComplete
                                    ? `Время: ${(() => {
                                          const d = parseIsoDuration(quiz.timeToComplete);
                                          return formatHumanDuration(d.hours, d.minutes, d.seconds);
                                      })()}`
                                    : 'Время: без ограничений'
                            }
                            variant="outlined"
                        />
                    </Box>
                    <Button
                        variant="contained"
                        sx={{mt: 3}}
                        onClick={() => navigate(`/quizzes/${id}/stats`)}
                    >
                        Просмотр статистики
                    </Button>
                </Card>
            )}

            <Snackbar
                open={notification.open}
                autoHideDuration={5000}
                onClose={() => setNotification((prev) => ({...prev, open: false}))}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
                sx={{mb: 8}}
            >
                <Alert
                    onClose={() => setNotification((prev) => ({...prev, open: false}))}
                    severity={notification.severity}
                    sx={{width: '100%', boxShadow: 3}}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export const EditQuizPage = () => {
    const {quizId: id} = useParams<{quizId: string}>();

    if (!id) {
        throw new Error('Missing quizId param');
    }

    const {data: quiz, isLoading: isQuizLoading} = useGetQuiz(id);

    if (isQuizLoading || !quiz) {
        return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
    }

    return <EditQuizContent key={quiz.id} id={id} initialQuiz={quiz} />;
};