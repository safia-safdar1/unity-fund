#![no_std]

use soroban_sdk::{contract, contractimpl, log, symbol_short, Env, Address, Symbol};

const GOAL_KEY: Symbol = symbol_short!("goal");
const TOTAL_FUNDS_KEY: Symbol = symbol_short!("total");
const RECIPIENT_KEY: Symbol = symbol_short!("recipient");

#[contract]
pub struct FundraisingContract;

#[contractimpl]
impl FundraisingContract {
    // Constructor to initialize the contract
    pub fn initialize(env: &Env, goal: u128, recipient: Address) {
        // Store initial values in storage
        env.storage().instance().set(&GOAL_KEY, &goal);
        env.storage().instance().set(&TOTAL_FUNDS_KEY, &0u128);
        env.storage().instance().set(&RECIPIENT_KEY, &recipient);

        log!(&env, "Fundraising contract initialized with goal: {} and recipient: {}", goal, recipient);
    }

    // Contribute function to send funds to the contract
    pub fn contribute(env: &Env, amount: u128) {
        assert!(amount > 0, "Contribution must be greater than zero.");

        // Update total funds
        let mut current_funds: u128 = env.storage().instance().get(&TOTAL_FUNDS_KEY).unwrap_or(0);
        current_funds += amount;

        // Update total funds in storage
        env.storage().instance().set(&TOTAL_FUNDS_KEY, &current_funds);
        log!(&env, "Total funds updated: {}", current_funds);

        // If total funds exceed the goal, send to the recipient
        let goal: u128 = env.storage().instance().get(&GOAL_KEY).unwrap();
        if current_funds >= goal {
            Self::execute_transfer(env, current_funds);
        }
    }

    // Execute the transfer to the recipient
    fn execute_transfer(env: &Env, amount: u128) {
        // Get recipient address
        let recipient: Address = env.storage().instance().get(&RECIPIENT_KEY).unwrap();

        // Transfer funds to the recipient
        let token_address = env.current_contract_address(); // Assume the contract itself is holding tokens
        let token_client = soroban_sdk::token::TokenClient::new(env, &token_address);

        // Transfer the total funds to the recipient
        token_client.transfer(&token_address, &recipient, &(amount as i128));

        // Reset total funds after transfer
        env.storage().instance().set(&TOTAL_FUNDS_KEY, &0u128);
        log!(&env, "Transferred {} to recipient: {}", amount, recipient);
    }

    // Get the total funds raised
    pub fn get_total_funds(env: &Env) -> u128 {
        env.storage().instance().get(&TOTAL_FUNDS_KEY).unwrap_or(0)
    }

    // Get the recipient address
    pub fn get_recipient(env: &Env) -> Address {
        env.storage().instance().get(&RECIPIENT_KEY).unwrap()
    }
}

mod test;
