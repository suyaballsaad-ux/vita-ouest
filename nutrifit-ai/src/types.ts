export type BodyType = 'Ectomorph' | 'Mesomorph' | 'Endomorph';
export type FitnessGoal = 'Weight Loss' | 'Muscle Gain' | 'Endurance' | 'General Health';

export interface UserProfile {
  weight: number;
  bodyType: BodyType;
  goal: FitnessGoal;
  dailyRequirements?: {
    water: string;
    calcium: string;
    protein: string;
    calories: string;
    other: string[];
  };
  isSetupComplete: boolean;
}

export interface DailyGoal {
  id: string;
  title: string;
  durationHours: number;
  startTime: number | null;
  remainingSeconds: number;
  isCompleted: boolean;
}

export interface FoodAnalysis {
  name: string;
  calories: string;
  nutrients: {
    protein: string;
    carbs: string;
    fats: string;
    vitamins: string[];
  };
  description: string;
}

export type Language = 'English' | 'Bengali' | 'Hindi' | 'Spanish' | 'French';
