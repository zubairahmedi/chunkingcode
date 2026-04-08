const fs = require('fs/promises');
const path = require('path');

const firstNames = ['Ethan', 'Mia', 'Lucas', 'Olivia', 'Noah', 'Ava', 'Liam', 'Sophia', 'Mason', 'Isabella', 'Logan', 'Amelia'];
const lastNames = ['Clark', 'Patel', 'Nguyen', 'Brown', 'Walker', 'Hall', 'Green', 'Lewis', 'Young', 'King', 'Scott', 'Allen'];
const locations = ['Mississauga', 'Toronto', 'Brampton', 'Oakville', 'Vaughan', 'Markham', 'Etobicoke', 'Milton', 'Burlington', 'Scarborough', 'Ajax', 'Hamilton'];
const leadTrainers = ['Kyle', 'Sarah', 'Jordan', 'Mark', 'Leo', 'Jenna', 'Chris', 'Priya'];
const assistantSets = ['Abraham, Develiers', 'Luke, Andre', 'Nina, Jorge', 'Emma, Tyson', 'Harper, Ben', 'Noah, Daniel'];
const activitySets = [
  {activities: 'Soccer passing games and relay races', grades: 'Grades 3-5', grouping: 'Balanced by age and confidence'},
  {activities: 'Basketball shooting stations and scrimmage', grades: 'Grades 5-8', grouping: 'Grouped by skill and size'},
  {activities: 'Cricket fundamentals and partner challenges', grades: 'Grades 4-7', grouping: 'Beginner and intermediate split'},
  {activities: 'Flag football drills and team games', grades: 'Grades 6-8', grouping: 'Mixed teams with coach rotation'},
  {activities: 'Multi-sport circuit with tennis and soccer', grades: 'Grades 2-4', grouping: 'Stations by attention level'},
  {activities: 'Shooting drills and footwork progressions', grades: 'Ages 9-13', grouping: 'Advanced and developing players'},
];
const positiveFeedback = [
  'Client praised energy, professionalism, and organization.',
  'Parents appreciated the structure and positive encouragement.',
  'School staff said the group stayed engaged throughout the session.',
  'Coach was happy with skill progression and communication.',
];
const mixedFeedback = [
  'Overall solid session, but transitions between drills felt slow.',
  'Parents liked the effort, though the group started slowly.',
  'Coach appreciated the session, but asked for tighter grouping next time.',
];
const negativeFeedback = [
  'Client noted the group felt overcrowded and less organized than usual.',
  'Coach reported low focus and asked for stronger session control next time.',
  'Parent feedback mentioned low energy and too much downtime between activities.',
];

function formatSheetDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildRow(index) {
  const baseDate = new Date(Date.UTC(2026, 2, 1 + Math.floor(index / 2)));
  const programType = index % 2 === 0 ? 1 : 2;
  const activity = activitySets[index % activitySets.length];
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[(index * 2) % lastNames.length];
  const location = locations[index % locations.length];
  const leadTrainer = leadTrainers[index % leadTrainers.length];
  const assistantNames = assistantSets[index % assistantSets.length];
  const hasInjury = index % 11 === 0;
  const hasIncident = index % 8 === 0;
  const hasEquipmentIssue = index % 7 === 0;
  const lowEnergy = index % 6 === 0;
  const wrongNumber = index % 17 === 0;
  const didNotPickUp = index % 13 === 0;
  const needsFollowUp = hasInjury || hasIncident || hasEquipmentIssue || lowEnergy || wrongNumber || didNotPickUp;

  let feedbackSentiment = 'positive';
  let clientFeedback = positiveFeedback[index % positiveFeedback.length];
  if (hasInjury || hasIncident || hasEquipmentIssue || lowEnergy) {
    feedbackSentiment = lowEnergy ? 'mixed' : 'negative';
    clientFeedback = lowEnergy ? mixedFeedback[index % mixedFeedback.length] : negativeFeedback[index % negativeFeedback.length];
  }

  const callStatus = wrongNumber ? 'wrong number' : didNotPickUp ? 'no answer' : 'completed';
  const aiCallStatus = didNotPickUp ? 'Did Not Pick Up' : needsFollowUp ? 'pending' : 'completed';
  const attemptNo = didNotPickUp ? 2 : needsFollowUp ? 1 : 0;
  const flagReason = hasInjury
    ? 'Injury reported; leadership follow-up required.'
    : hasIncident
      ? 'Incident reported during session; review needed.'
      : hasEquipmentIssue
        ? 'Equipment issue noted; inventory check required.'
        : wrongNumber
          ? 'Wrong number reached; trainer contact needs correction.'
          : lowEnergy
            ? 'Low engagement reported; coaching follow-up recommended.'
            : 'None';

  return {
    row_number: index + 2,
    Date: formatSheetDate(baseDate),
    'First Name': firstName,
    'Last Name': lastName,
    'Phone Number': Number(`647555${String(1000 + index).padStart(4, '0')}`),
    'Program Type': programType,
    Location: location,
    'Lead Trainer Name': leadTrainer,
    'Assistant Trainer Names': assistantNames,
    'Assistant Trainer Performance': lowEnergy ? 'Steady effort, but energy dropped in the middle of the session.' : 'Strong energy, good communication, and helpful station management.',
    'Grades/Age Range': activity.grades,
    Attendance: lowEnergy ? `${10 + (index % 6)} present; lighter than usual turnout` : `${18 + (index % 8)} present; healthy turnout`,
    'Participation Level': lowEnergy ? 'mixed / uneven' : 'high and engaged',
    'Group Energy Level': lowEnergy ? 'lower than expected' : 'strong and positive',
    'Activities/Games Played': activity.activities,
    'Grouping by Skill Level': activity.grouping,
    'Injuries Reported?': hasInjury ? 'yes' : 'no',
    'Injury Description': hasInjury ? 'Minor ankle or wrist complaint reported and monitored on site.' : 'None reported.',
    'Incidents Reported?': hasIncident ? 'yes' : 'no',
    'Incident Description': hasIncident ? 'Brief behavior or transition issue required trainer intervention.' : 'None reported.',
    'Who Was Notified': hasInjury || hasIncident ? 'School staff / parent contact' : 'No one needed to be notified',
    'Equipment Issues?': hasEquipmentIssue ? 'yes' : 'no',
    'Equipment Issue Description': hasEquipmentIssue ? 'Missing cones / flat ball slowed part of the session.' : 'No equipment issues noted.',
    'Client Feedback': clientFeedback,
    'Feedback Sentiment': feedbackSentiment,
    'Tip Received?': programType === 1 && index % 9 === 0 ? 'yes' : 'not applicable',
    'Tip Amount': programType === 1 && index % 9 === 0 ? `${10 + (index % 3) * 5}` : '',
    'Call Status': callStatus,
    'Call Attempt Time': ['8:30 AM PDT', '10:30 AM PDT', '12:00 PM PDT', '1:00 PM PDT', '3:00 PM PDT', '5:00 PM PDT'][index % 6],
    'Caller Name': callStatus === 'completed' ? 'AI reporting agent' : '',
    'Date Called': formatIsoDate(baseDate),
    'Needs Follow-up?': needsFollowUp ? 'yes' : 'no',
    'Flag Reason': flagReason,
    aicall_status: aiCallStatus,
    Attemp_no: attemptNo,
  };
}

async function main() {
  const rows = Array.from({length: 72}, (_, index) => buildRow(index));
  const payload = [
    {
      reportType: 'monthly',
      generatedAt: '2026-04-08T12:50:00.000Z',
      source: 'google-sheets',
      totalRows: rows.length,
      dateRange: {
        start: rows[0].Date,
        end: rows[rows.length - 1].Date,
      },
      rows,
    },
  ];

  const formatted = `${JSON.stringify(payload, null, 2)}\n`;
  const repoRoot = path.resolve(__dirname, '..', '..');
  const serviceExamplePath = path.join(repoRoot, 'render-reporting-service', 'examples', 'monthly-sample-payload.json');
  const rootExamplePath = path.join(repoRoot, 'example monthly body.json');

  await fs.writeFile(serviceExamplePath, formatted, 'utf8');
  await fs.writeFile(rootExamplePath, formatted, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    totalRows: rows.length,
    serviceExamplePath,
    rootExamplePath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
