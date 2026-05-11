import { NextResponse } from 'next/server';
import { optimizeMonthlyScheduleWithAI, validateWeeklyScheduleWithAI, getPersonalAISummary, getMonthlyExecutiveSummaryWithAI } from '@/lib/ai-bridge';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, data } = body;

        let result;
        switch (action) {
            case 'optimize':
                const month = data?.month ? new Date(data.month) : new Date();
                result = await optimizeMonthlyScheduleWithAI(month);
                break;
            case 'validate':
                if (!data?.weekStart) return NextResponse.json({ error: 'Thiếu weekStart' }, { status: 400 });
                result = await validateWeeklyScheduleWithAI(data.weekStart);
                break;
            case 'notify':
                if (!data?.staffId) return NextResponse.json({ error: 'Thiếu staffId' }, { status: 400 });
                result = await getPersonalAISummary(data.staffId);
                break;
            case 'report':
                if (!data?.month) return NextResponse.json({ error: 'Thiếu month' }, { status: 400 });
                result = await getMonthlyExecutiveSummaryWithAI(data.month);
                break;
            default:
                return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
        }

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('AI Route Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
