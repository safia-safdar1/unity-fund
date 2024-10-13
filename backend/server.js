const express = require('express');
const bodyParser = require('body-parser');
const StellarSdk = require('stellar-sdk');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Set the Stellar Test Network server
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

// Store members and contributions
let members = [];
let contributions = [];
let currentPayoutIndex = 0; // Tracks which member gets paid out each month

// Function to create a new Stellar account
const createAccount = async () => {
    const pair = StellarSdk.Keypair.random();
    const account = pair.publicKey();
    const secret = pair.secret();

    console.log(`New account created: ${account}`);
    console.log(`Secret key: ${secret}`);
    
    return { account, secret };
};

// Function to check if an account exists on the Stellar network
const accountExists = async (accountId) => {
    try {
        await server.loadAccount(accountId);
        console.log(`Account ${accountId} exists.`);
        return true;
    } catch (error) {
        if (error instanceof StellarSdk.NotFoundError) {
            console.error(`Account ${accountId} not found.`);
        }
        return false;
    }
};

// Initialize members (you can also create accounts dynamically)
const initializeMembers = async () => {
    for (let i = 0; i < 4; i++) {
        const { account, secret } = await createAccount();
        members.push({ account, secret });
        contributions.push(0); // Initialize contributions for the member
    }

    console.log("Creating shared account with the following member accounts:");
    for (const member of members) {
        console.log(member.account);
        const exists = await accountExists(member.account);
        if (!exists) {
            console.error(`Account ${member.account} does not exist. Please fund this account before proceeding.`);
            return;
        }
    }

    // Here, you could add logic to create a shared account or any specific operations
};

// Endpoint to view members
app.get('/members', (req, res) => {
    res.json({ members });
});

// Endpoint for members to contribute
app.post('/contribute', (req, res) => {
    const { account } = req.body;

    // Check if the member exists
    const memberIndex = members.findIndex(member => member.account === account);
    if (memberIndex === -1) {
        return res.status(404).json({ message: 'Member not found' });
    }

    // Accumulate contributions
    contributions[memberIndex] += 10; // Each member contributes £10
    res.json({ message: 'Contribution received', account, contribution: 10 });
});

// Function to send payments
const sendPayment = async (sourceSecret, destinationAccount, amount) => {
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);

    const account = await server.loadAccount(sourceKeypair.publicKey());
    const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.payment({
        destination: destinationAccount,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString(),
    }))
    .setTimeout(30)
    .build();

    transaction.sign(sourceKeypair);
    await server.submitTransaction(transaction);
    console.log(`Payment of ${amount} XLM sent to ${destinationAccount}`);
};

// Schedule monthly payments
cron.schedule('0 0 1 * *', async () => {
    console.log('Distributing monthly ROSCA payments...');

    // Ensure the currentPayoutIndex is within the bounds of the members array
    if (currentPayoutIndex < members.length) {
        const member = members[currentPayoutIndex];
        const totalContribution = contributions.reduce((sum) => sum + 10, 0); // Total contributions this month
        if (totalContribution > 0) {
            // Send payout to the current member
            await sendPayment(member.secret, member.account, totalContribution);
            contributions = contributions.map(() => 0); // Reset contributions after payment
        }
        currentPayoutIndex++; // Move to the next member for the next month
    } else {
        console.log('All members have been paid out, resetting payout index...');
        currentPayoutIndex = 0; // Reset the index after all members have been paid
    }
});

// Initialize members when the server starts
initializeMembers().then(() => {
    // Start server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Error initializing members:', err);
});
